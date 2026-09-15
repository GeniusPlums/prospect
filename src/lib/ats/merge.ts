import { sql } from "@/lib/db";
import { mergeAtsFetch, writeAtsRemote } from "@/lib/adapters/registry";
import { nid } from "@/lib/ids";
import { getCandidate } from "@/lib/data/candidates";

export async function syncMerge(orgId: string) {
  const existing = await sql<{ id: string }>(`SELECT id FROM ats_connection WHERE org_id=$1 LIMIT 1`, [orgId]);
  const people = await mergeAtsFetch(orgId);
  const provider =
    people[0] && "provider" in people[0] ? String((people[0] as { provider?: string }).provider) : "composio";
  const connId = existing[0]?.id ?? nid("ats");
  if (!existing[0]) {
    await sql(`INSERT INTO ats_connection (id, org_id, provider, status) VALUES ($1,$2,$3,$4)`, [
      connId,
      orgId,
      provider,
      people.length ? "connected" : "idle",
    ]);
  }
  for (const person of people) {
    const match = await sql<{ id: string }>(
      `SELECT id FROM candidate WHERE lower(display_name)=lower($1) LIMIT 1`,
      [person.name],
    );
    await sql(
      `INSERT INTO ats_person (id, ats_connection_id, merge_id, candidate_id, name, stage, outcome)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [nid("ap"), connId, person.mergeId, match[0]?.id ?? null, person.name, person.stage, person.outcome],
    );
  }
  return connId;
}

export async function writeAts(orgId: string, candidateId: string, op: string, payload: unknown) {
  const conn = await sql<{ id: string }>(`SELECT id FROM ats_connection WHERE org_id=$1 LIMIT 1`, [orgId]);
  const connId = conn[0]?.id ?? (await syncMerge(orgId));
  const person = getCandidate(candidateId);
  const stored = person
    ? null
    : await sql<{ display_name: string }>(`SELECT display_name FROM candidate WHERE id=$1`, [candidateId]);
  const remote = await writeAtsRemote(orgId, person?.name ?? stored?.[0]?.display_name ?? candidateId, payload);
  await sql(
    `INSERT INTO ats_write (id, ats_connection_id, candidate_id, op, payload) VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [nid("aw"), connId, candidateId, op, JSON.stringify({ payload, remote })],
  );
  return remote;
}
