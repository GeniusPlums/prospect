import { insertMany, sql, sqlOne } from "@/lib/db";
import { DEV_ORG, nid } from "@/lib/ids";
import type { Icp } from "@/lib/types";

export type AuthorType = "user" | "system";

export type StoredIcp = Icp & {
  id: string;
  orgId: string;
  roleKey: string;
  version: number;
  authorType: AuthorType;
  acceptedAt: string | null;
  parentId: string | null;
};

type CriterionKind = "must" | "nice" | "disqualifier";

async function nextVersion(orgId: string, roleKey: string): Promise<number> {
  const row = await sqlOne<{ v: string }>(
    `SELECT coalesce(max(version), 0)::text as v FROM icp_version WHERE org_id = $1 AND role_key = $2`,
    [orgId, roleKey],
  );
  return Number(row?.v ?? 0) + 1;
}

export async function currentOrgRules(orgId: string): Promise<{
  must: string[];
  nice: string[];
  disqualifiers: string[];
} | null> {
  const row = await sqlOne<{ must: unknown; nice: unknown; disqualifiers: unknown }>(
    `SELECT must, nice, disqualifiers FROM org_rule_version
     WHERE org_id = $1 AND accepted_at IS NOT NULL
     ORDER BY version DESC LIMIT 1`,
    [orgId],
  );
  if (!row) return null;
  return {
    must: (row.must as string[]) ?? [],
    nice: (row.nice as string[]) ?? [],
    disqualifiers: (row.disqualifiers as string[]) ?? [],
  };
}

export function inheritRules(icp: Icp, rules: { must: string[]; nice: string[]; disqualifiers: string[] } | null): Icp {
  if (!rules) return icp;
  const uniq = (a: string[]) => [...new Set(a.filter(Boolean))];
  return {
    ...icp,
    must: uniq([...rules.must, ...icp.must]),
    nice: uniq([...rules.nice, ...icp.nice]),
    disqualifiers: uniq([...rules.disqualifiers, ...icp.disqualifiers]),
  };
}

async function insertCriteria(icpVersionId: string, icp: Icp) {
  const rows: { kind: CriterionKind; body: string }[] = [
    ...icp.must.map((body) => ({ kind: "must" as const, body })),
    ...icp.nice.map((body) => ({ kind: "nice" as const, body })),
    ...icp.disqualifiers.map((body) => ({ kind: "disqualifier" as const, body })),
  ];
  await insertMany(
    `INSERT INTO icp_criterion (id, icp_version_id, kind, body, machine_spec, position) VALUES`,
    rows.map((row, i) => [
      nid("crt"),
      icpVersionId,
      row.kind,
      row.body,
      JSON.stringify({ tokens: row.body.toLowerCase() }),
      i,
    ]),
    [undefined, undefined, undefined, undefined, "jsonb", undefined],
  );
}

export async function writeIcpVersion(input: {
  orgId?: string;
  roleKey: string;
  icp: Icp;
  authorType: AuthorType;
  parentId?: string | null;
  accept?: boolean;
}): Promise<StoredIcp> {
  const orgId = input.orgId ?? DEV_ORG;
  const version = await nextVersion(orgId, input.roleKey);
  const id = nid("icp");
  const acceptedAt = input.authorType === "system" && !input.accept ? null : new Date().toISOString();
  const merged = inheritRules(input.icp, await currentOrgRules(orgId));
  await sql(
    `INSERT INTO icp_version (
      id, org_id, role_key, version, parent_id, author_type, accepted_at,
      title, summary, seniority, years_min, years_max, locations, company_kinds, skills
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb)`,
    [
      id,
      orgId,
      input.roleKey,
      version,
      input.parentId ?? null,
      input.authorType,
      acceptedAt,
      merged.title,
      merged.summary,
      merged.seniority,
      merged.yearsMin,
      merged.yearsMax,
      JSON.stringify(merged.locations),
      JSON.stringify(merged.companyKinds),
      JSON.stringify(merged.skills),
    ],
  );
  await insertCriteria(id, merged);
  return { ...merged, id, orgId, roleKey: input.roleKey, version, authorType: input.authorType, acceptedAt, parentId: input.parentId ?? null };
}

export async function acceptIcpVersion(id: string): Promise<void> {
  await sql(`UPDATE icp_version SET accepted_at = now() WHERE id = $1 AND accepted_at IS NULL`, [id]);
}

export async function getIcp(id: string): Promise<StoredIcp | undefined> {
  const row = await sqlOne<{
    id: string;
    org_id: string;
    role_key: string;
    version: number;
    parent_id: string | null;
    author_type: AuthorType;
    accepted_at: string | null;
    title: string;
    summary: string;
    seniority: Icp["seniority"];
    years_min: number;
    years_max: number;
    locations: unknown;
    company_kinds: unknown;
    skills: unknown;
  }>(`SELECT * FROM icp_version WHERE id = $1`, [id]);
  if (!row) return undefined;
  const criteria = await sql<{ kind: CriterionKind; body: string }>(
    `SELECT kind, body FROM icp_criterion WHERE icp_version_id = $1 ORDER BY position`,
    [id],
  );
  const pick = (kind: CriterionKind) => criteria.filter((c) => c.kind === kind).map((c) => c.body);
  return {
    id: row.id,
    orgId: row.org_id,
    roleKey: row.role_key,
    version: row.version,
    authorType: row.author_type,
    acceptedAt: row.accepted_at,
    parentId: row.parent_id,
    title: row.title,
    summary: row.summary,
    seniority: row.seniority,
    yearsMin: row.years_min,
    yearsMax: row.years_max,
    locations: (row.locations as string[]) ?? [],
    companyKinds: (row.company_kinds as Icp["companyKinds"]) ?? [],
    skills: (row.skills as string[]) ?? [],
    must: pick("must"),
    nice: pick("nice"),
    disqualifiers: pick("disqualifier"),
  };
}

export async function proposeIcpDiffVersion(input: {
  parent: StoredIcp;
  addMust: string[];
  addDisqualifiers: string[];
  note: string;
}): Promise<StoredIcp> {
  const icp: Icp = {
    title: input.parent.title,
    summary: input.parent.summary,
    must: [...input.parent.must, ...input.addMust],
    nice: input.parent.nice,
    disqualifiers: [...input.parent.disqualifiers, ...input.addDisqualifiers],
    locations: input.parent.locations,
    seniority: input.parent.seniority,
    yearsMin: input.parent.yearsMin,
    yearsMax: input.parent.yearsMax,
    companyKinds: input.parent.companyKinds,
    skills: input.parent.skills,
  };
  return writeIcpVersion({
    orgId: input.parent.orgId,
    roleKey: input.parent.roleKey,
    icp,
    authorType: "system",
    parentId: input.parent.id,
    accept: false,
  });
}

export async function writeOrgRules(input: {
  orgId?: string;
  must: string[];
  nice: string[];
  disqualifiers: string[];
  authorType?: AuthorType;
}): Promise<string> {
  const orgId = input.orgId ?? DEV_ORG;
  const row = await sqlOne<{ v: string }>(
    `SELECT coalesce(max(version), 0)::text as v FROM org_rule_version WHERE org_id = $1`,
    [orgId],
  );
  const version = Number(row?.v ?? 0) + 1;
  const id = nid("rul");
  await sql(
    `INSERT INTO org_rule_version (id, org_id, version, author_type, accepted_at, must, nice, disqualifiers)
     VALUES ($1,$2,$3,$4,now(),$5::jsonb,$6::jsonb,$7::jsonb)`,
    [
      id,
      orgId,
      version,
      input.authorType ?? "user",
      JSON.stringify(input.must),
      JSON.stringify(input.nice),
      JSON.stringify(input.disqualifiers),
    ],
  );
  return id;
}
