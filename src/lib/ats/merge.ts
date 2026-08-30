import { sql } from "@/lib/db";
import { mergeAtsFetch } from "@/lib/adapters/registry";
import { nid } from "@/lib/ids";
import { candidates } from "@/lib/data/candidates";

function mergeConfidence(name: string, companyHint: string): { id: string | null; confidence: number } {
  const lower = name.toLowerCase();
  const hit = candidates.find((c) => c.name.toLowerCase() === lower);
  if (hit) return { id: hit.id, confidence: 1 };
  const loose = candidates.find((c) => lower.includes(c.name.split(" ")[0]!.toLowerCase()) && companyHint);
  if (loose) return { id: loose.id, confidence: 0.6 };
  return { id: null, confidence: 0 };
}

export async function syncMerge(orgId: string) {
  const existing = await sql<{ id: string }>(`SELECT id FROM ats_connection WHERE org_id=$1 LIMIT 1`, [orgId]);
  const connId = existing[0]?.id ?? nid("ats");
  if (!existing[0]) {
    await sql(`INSERT INTO ats_connection (id, org_id, provider, status) VALUES ($1,$2,'merge','connected')`, [
      connId,
      orgId,
    ]);
  }
  const people = await mergeAtsFetch(orgId);
  for (const person of people) {
    const match = mergeConfidence(person.name, "");
    await sql(
      `INSERT INTO ats_person (id, ats_connection_id, merge_id, candidate_id, name, stage, outcome)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [nid("ap"), connId, person.mergeId, match.id, person.name, person.stage, person.outcome],
    );
  }
  return connId;
}

export async function writeAts(orgId: string, candidateId: string, op: string, payload: unknown) {
  const conn = await sql<{ id: string }>(`SELECT id FROM ats_connection WHERE org_id=$1 LIMIT 1`, [orgId]);
  const connId = conn[0]?.id ?? (await syncMerge(orgId));
  await sql(
    `INSERT INTO ats_write (id, ats_connection_id, candidate_id, op, payload) VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [nid("aw"), connId, candidateId, op, JSON.stringify(payload)],
  );
}
