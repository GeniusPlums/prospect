import { sql } from "@/lib/db";
import { DEV_ORG } from "@/lib/ids";

export function corpusOrgIds(orgId: string): [string, string] {
  return [orgId, DEV_ORG];
}

export async function cachedIds(orgId: string, externalIds: string[]) {
  const [userOrg, shared] = corpusOrgIds(orgId);
  const rows = await sql<{ id: string; external_id: string | null }>(
    `SELECT c.id, ps.external_id
     FROM candidate c
     LEFT JOIN profile_source ps ON ps.candidate_id = c.id
     WHERE c.org_id = $1 OR c.org_id = $2`,
    [userOrg, shared],
  );
  const have = new Set<string>();
  for (const row of rows) {
    have.add(row.id);
    if (row.external_id) have.add(row.external_id);
  }
  return {
    hits: externalIds.filter((id) => have.has(id)),
    misses: externalIds.filter((id) => !have.has(id)),
  };
}

export async function loadPeople(ids: string[]) {
  if (ids.length === 0) return [] as { id: string; display_name: string; headline: string; city: string }[];
  return sql<{ id: string; display_name: string; headline: string; city: string }>(
    `SELECT id, display_name, headline, city FROM candidate WHERE id = ANY($1::text[])`,
    [ids],
  );
}
