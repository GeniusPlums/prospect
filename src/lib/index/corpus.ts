import { sql } from "@/lib/db";
import { DEV_ORG } from "@/lib/ids";

export type CachedHit = { externalId: string; candidateId: string };

export function corpusOrgIds(orgId: string, includeShared: boolean): [string, string] {
  return [orgId, includeShared ? DEV_ORG : orgId];
}

export async function cachedIds(orgId: string, externalIds: string[], includeShared: boolean) {
  if (externalIds.length === 0) return { hits: [] as CachedHit[], misses: [] as string[] };
  const [userOrg, shared] = corpusOrgIds(orgId, includeShared);
  const rows = await sql<{ id: string; external_id: string | null }>(
    `SELECT c.id, ps.external_id
     FROM candidate c
     LEFT JOIN profile_source ps ON ps.candidate_id = c.id
     WHERE (c.org_id = $1 OR c.org_id = $2)
       AND (c.id = ANY($3::text[]) OR ps.external_id = ANY($3::text[]))`,
    [userOrg, shared, externalIds],
  );
  const byExternal = new Map<string, string>();
  for (const row of rows) {
    byExternal.set(row.id, row.id);
    if (row.external_id) byExternal.set(row.external_id, row.id);
  }
  const hits: CachedHit[] = [];
  const misses: string[] = [];
  const seen = new Set<string>();
  for (const id of externalIds) {
    const candidateId = byExternal.get(id);
    if (candidateId && !seen.has(candidateId)) {
      seen.add(candidateId);
      hits.push({ externalId: id, candidateId });
    } else if (!candidateId) {
      misses.push(id);
    }
  }
  return { hits, misses };
}

export type StoredDossier = {
  id: string;
  displayName: string;
  headline: string;
  city: string;
  years: number;
  linkedinUrl: string | null;
  hay: string;
};

export async function loadDossiers(ids: string[]): Promise<StoredDossier[]> {
  if (ids.length === 0) return [];
  const people = await sql<{
    id: string;
    display_name: string;
    headline: string;
    city: string;
    years: number;
    linkedin_url: string | null;
  }>(
    `SELECT id, display_name, headline, city, years, linkedin_url FROM candidate WHERE id = ANY($1::text[])`,
    [ids],
  );
  const signals = await sql<{ candidate_id: string; body: string }>(
    `SELECT candidate_id, body FROM signal WHERE candidate_id = ANY($1::text[])`,
    [ids],
  );
  const byId = new Map<string, string[]>();
  for (const row of signals) {
    const list = byId.get(row.candidate_id) ?? [];
    list.push(row.body);
    byId.set(row.candidate_id, list);
  }
  return people.map((person) => ({
    id: person.id,
    displayName: person.display_name,
    headline: person.headline,
    city: person.city,
    years: person.years,
    linkedinUrl: person.linkedin_url,
    hay: [person.display_name, person.headline, person.city, String(person.years), ...(byId.get(person.id) ?? [])]
      .filter(Boolean)
      .join(" "),
  }));
}

export async function loadPeople(ids: string[]) {
  if (ids.length === 0) return [] as { id: string; display_name: string; headline: string; city: string }[];
  return sql<{ id: string; display_name: string; headline: string; city: string }>(
    `SELECT id, display_name, headline, city FROM candidate WHERE id = ANY($1::text[])`,
    [ids],
  );
}
