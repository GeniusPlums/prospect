import { sql } from "@/lib/db";
import { contactWaterfall, verifyEmail } from "@/lib/adapters/registry";
import { remaining, recordUsage } from "@/lib/billing/meter";
import { nid } from "@/lib/ids";
import { getCandidate } from "@/lib/data/candidates";
import { draftOutreach, draftOutreachSubject } from "@/lib/ranking";
import { getIcp } from "@/lib/icp/engine";
import { sendViaNango } from "@/lib/adapters/registry";

export async function revealContact(input: {
  orgId: string;
  searchRunId: string;
  candidateId: string;
  plan?: "free" | "pro" | "team" | "scale";
}) {
  const left = await remaining(input.orgId, input.plan ?? "pro", "reveal");
  if (left <= 0) return { ok: false as const, error: "Reveal quota exhausted" };
  const person = getCandidate(input.candidateId);
  const { attempts, hit } = await contactWaterfall(person?.name ?? input.candidateId);
  for (const a of attempts) {
    await sql(
      `INSERT INTO enrichment_attempt (id, org_id, candidate_id, search_run_id, provider, cost_usd, outcome)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [nid("enr"), input.orgId, input.candidateId, input.searchRunId, a.provider, a.costUsd, a.outcome],
    );
  }
  if (!hit) return { ok: false as const, error: "No email found" };
  const verified = await verifyEmail(hit.email);
  await sql(
    `INSERT INTO reveal (id, org_id, search_run_id, candidate_id, email, verified)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (search_run_id, candidate_id) DO UPDATE SET email=$5, verified=$6`,
    [nid("rev"), input.orgId, input.searchRunId, input.candidateId, hit.email, verified],
  );
  await recordUsage(input.orgId, "reveal", 1);
  return { ok: true as const, email: hit.email, verified };
}

export async function draftGroundedOutreach(searchRunId: string, candidateId: string) {
  const run = await sql<{ icp_version_id: string }>(`SELECT icp_version_id FROM search_run WHERE id=$1`, [searchRunId]);
  const icp = await getIcp(run[0]!.icp_version_id);
  const candidate = getCandidate(candidateId);
  if (!icp || !candidate) return null;
  const signals = await sql<{ id: string; kind: string; body: string; provenance_url: string }>(
    `SELECT id, kind, body, provenance_url FROM signal WHERE candidate_id=$1`,
    [candidateId],
  );
  const facts = signals.slice(0, 4).map((s) => ({ signalId: s.id, kind: s.kind, url: s.provenance_url }));
  const body = draftOutreach(candidate, icp);
  const subject = draftOutreachSubject(candidate, icp);
  return { subject, body, personalizationFacts: facts };
}

export async function sendOutreach(input: {
  orgId: string;
  searchRunId: string;
  candidateId: string;
  to: string;
  subject: string;
  body: string;
  facts: { signalId: string; kind: string; url: string }[];
}) {
  const sent = await sendViaNango({ to: input.to, subject: input.subject, body: input.body });
  await sql(
    `INSERT INTO outreach (id, org_id, search_run_id, candidate_id, to_email, subject, body, personalization_facts, sent_at, via)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,now(),$9)`,
    [
      nid("out"),
      input.orgId,
      input.searchRunId,
      input.candidateId,
      input.to,
      input.subject,
      input.body,
      JSON.stringify(input.facts),
      sent.via,
    ],
  );
  return sent;
}
