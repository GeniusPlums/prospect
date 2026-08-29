import { createServerFn } from "@tanstack/react-start";
import { ensureDbReady, sql } from "@/lib/db";
import { DEV_ORG } from "@/lib/ids";
import { writeIcpVersion, getIcp, acceptIcpVersion, writeOrgRules, currentOrgRules } from "@/lib/icp/engine";
import { createAndRunSearch, applyFeedback } from "@/lib/pipeline/run-search";
import { parseBrief } from "@/lib/ai/parse-brief";
import { sampleBriefs } from "@/lib/data/sample-briefs";
import { revealContact, draftGroundedOutreach, sendOutreach } from "@/lib/reveal/reveal";
import { screenResume } from "@/lib/screen/inbox";
import { syncMerge, writeAts } from "@/lib/ats/merge";
import { cacheHitRate, criteriaContradiction, ensureDefaultAutomations, fireAlwaysOn, precisionOverTime } from "@/lib/ops/dashboard";
import { remaining, usageInCycle, pushAddonsForCycle } from "@/lib/billing/meter";
import { runEvalSuite } from "@/lib/eval/run-eval";
import { nid } from "@/lib/ids";
import type { Icp, FeedbackVote } from "@/lib/types";

async function boot() {
  await ensureDbReady();
}

export const startFromBrief = createServerFn({ method: "POST" })
  .validator((input: { text: string; sampleId?: string; icp?: Icp }) => input)
  .handler(async ({ data }) => {
    await boot();
    const sample = sampleBriefs.find((s) => s.id === data.sampleId || s.jd.trim() === data.text.trim());
    let icp: Icp;
    if (data.icp) icp = data.icp;
    else if (sample) icp = sample.icp;
    else {
      const parsed = await parseBrief({ data: { text: data.text } });
      if (!parsed.ok) return { ok: false as const, error: parsed.error };
      icp = parsed.icp;
    }
    const stored = await writeIcpVersion({
      roleKey: sample?.id ?? "custom",
      icp,
      authorType: "user",
    });
    const searchId = await createAndRunSearch({
      orgId: DEV_ORG,
      icp: stored,
      briefText: data.text,
    });
    return { ok: true as const, searchId, icp: stored };
  });

export const loadSearch = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await boot();
    const run = await sql<{
      id: string;
      status: string;
      icp_version_id: string;
      brief_text: string;
      cache_hits: number;
      cache_misses: number;
      created_at: string;
    }>(`SELECT id, status, icp_version_id, brief_text, cache_hits, cache_misses, created_at FROM search_run WHERE id=$1`, [
      data.id,
    ]);
    if (!run[0]) return { ok: false as const };
    const icp = await getIcp(run[0].icp_version_id);
    const events = await sql<{ step: string; message: string; at: string }>(
      `SELECT step, message, at FROM pipeline_event WHERE search_run_id=$1 ORDER BY at`,
      [data.id],
    );
    const scores = await sql<{
      id: string;
      candidate_id: string;
      case_for: string;
      case_against: string;
      unclear: string;
      verdict: string;
      disqualified: boolean;
      disqualifier_flags: string;
      for_weight: number;
      against_weight: number;
      unclear_weight: number;
      final_rank: number | null;
      held_back: boolean;
      held_back_rules: string;
      model_version: string;
      prompt_version: string;
      icp_version_id: string;
    }>(
      `SELECT id, candidate_id, case_for, case_against, unclear::text, verdict, disqualified,
              disqualifier_flags::text, for_weight, against_weight, unclear_weight,
              final_rank, held_back, held_back_rules::text, model_version, prompt_version, icp_version_id
       FROM candidate_score WHERE search_run_id=$1 ORDER BY coalesce(final_rank, 999), held_back desc`,
      [data.id],
    );
    const objections = await sql<{ candidate_score_id: string; claim: string; objection: string }>(
      `SELECT candidate_score_id, claim, objection FROM reviewer_objection WHERE candidate_score_id IN (SELECT id FROM candidate_score WHERE search_run_id=$1)`,
      [data.id],
    );
    const feedback = await sql<{ candidate_id: string; vote: string; tags: string }>(
      `SELECT candidate_id, vote, tags::text as tags FROM feedback WHERE search_run_id=$1`,
      [data.id],
    );
    const reveals = await sql<{ candidate_id: string; email: string; verified: boolean }>(
      `SELECT candidate_id, email, verified FROM reveal WHERE search_run_id=$1`,
      [data.id],
    );
    return { ok: true as const, run: run[0], icp, events, scores, objections, feedback, reveals };
  });

export const voteCandidate = createServerFn({ method: "POST" })
  .validator((input: { searchId: string; candidateId: string; vote: FeedbackVote }) => input)
  .handler(async ({ data }) => {
    await boot();
    const proposed = await applyFeedback(data.searchId, data.candidateId, data.vote);
    return { ok: true as const, proposed };
  });

export const acceptProposedIcp = createServerFn({ method: "POST" })
  .validator((input: { icpId: string }) => input)
  .handler(async ({ data }) => {
    await boot();
    await acceptIcpVersion(data.icpId);
    return { ok: true as const };
  });

export const doReveal = createServerFn({ method: "POST" })
  .validator((input: { searchId: string; candidateId: string }) => input)
  .handler(async ({ data }) => {
    await boot();
    return revealContact({ orgId: DEV_ORG, searchRunId: data.searchId, candidateId: data.candidateId });
  });

export const loadOutreach = createServerFn({ method: "GET" })
  .validator((input: { searchId: string; candidateId: string }) => input)
  .handler(async ({ data }) => {
    await boot();
    return draftGroundedOutreach(data.searchId, data.candidateId);
  });

export const doSend = createServerFn({ method: "POST" })
  .validator(
    (input: {
      searchId: string;
      candidateId: string;
      to: string;
      subject: string;
      body: string;
      facts: { signalId: string; kind: string; url: string }[];
    }) => input,
  )
  .handler(async ({ data }) => {
    await boot();
    return sendOutreach({
      orgId: DEV_ORG,
      searchRunId: data.searchId,
      candidateId: data.candidateId,
      to: data.to,
      subject: data.subject,
      body: data.body,
      facts: data.facts,
    });
  });

export const listSearches = createServerFn({ method: "GET" }).handler(async () => {
  await boot();
  return sql<{ id: string; status: string; created_at: string; title: string; cache_hits: number; cache_misses: number; icp_version_id: string }>(
    `SELECT r.id, r.status, r.created_at, i.title, r.cache_hits, r.cache_misses, r.icp_version_id
     FROM search_run r JOIN icp_version i ON i.id = r.icp_version_id
     ORDER BY r.created_at DESC LIMIT 40`,
  );
});

export const dashboard = createServerFn({ method: "GET" }).handler(async () => {
  await boot();
  const [precision, cache, insight, automations, evals, usage] = await Promise.all([
    precisionOverTime(DEV_ORG),
    cacheHitRate(DEV_ORG),
    criteriaContradiction(DEV_ORG),
    ensureDefaultAutomations(DEV_ORG),
    sql<{ id: string; p_at_5: number; ndcg10: number; passed: boolean; created_at: string; notes: string }>(
      `SELECT id, p_at_5, ndcg10, passed, created_at, notes FROM eval_run ORDER BY created_at DESC LIMIT 8`,
    ),
    Promise.all([
      remaining(DEV_ORG, "pro", "profile"),
      remaining(DEV_ORG, "pro", "reveal"),
      usageInCycle(DEV_ORG, "profile"),
      usageInCycle(DEV_ORG, "reveal"),
    ]),
  ]);
  return {
    precision,
    cache,
    insight,
    automations,
    evals,
    remaining: { profiles: usage[0], reveals: usage[1] },
    used: { profiles: usage[2], reveals: usage[3] },
  };
});

export const runBillingCron = createServerFn({ method: "POST" }).handler(async () => {
  await boot();
  const cycle = new Date();
  cycle.setUTCDate(cycle.getUTCDate() + 2);
  const label = `${cycle.getUTCFullYear()}-${String(cycle.getUTCMonth() + 1).padStart(2, "0")}`;
  await pushAddonsForCycle(DEV_ORG, "sub_local", label);
  return { ok: true as const };
});

export const screen = createServerFn({ method: "POST" })
  .validator((input: { icpId: string; resumeText: string }) => input)
  .handler(async ({ data }) => {
    await boot();
    return screenResume({ orgId: DEV_ORG, icpVersionId: data.icpId, resumeText: data.resumeText });
  });

export const connectAts = createServerFn({ method: "POST" }).handler(async () => {
  await boot();
  const id = await syncMerge(DEV_ORG);
  const people = await sql<{ id: string; name: string; stage: string; outcome: string | null }>(
    `SELECT id, name, stage, outcome FROM ats_person ORDER BY name`,
  );
  return { id, people };
});

export const atsWrite = createServerFn({ method: "POST" })
  .validator((input: { candidateId: string }) => input)
  .handler(async ({ data }) => {
    await boot();
    await writeAts(DEV_ORG, data.candidateId, "add_to_job", { stage: "sourced" });
    return { ok: true as const };
  });

export const saveRules = createServerFn({ method: "POST" })
  .validator((input: { must: string[]; nice: string[]; disqualifiers: string[] }) => input)
  .handler(async ({ data }) => {
    await boot();
    const id = await writeOrgRules(data);
    return { id, current: await currentOrgRules(DEV_ORG) };
  });

export const loadRules = createServerFn({ method: "GET" }).handler(async () => {
  await boot();
  return currentOrgRules(DEV_ORG);
});

export const tickAlwaysOn = createServerFn({ method: "POST" }).handler(async () => {
  await boot();
  await fireAlwaysOn(DEV_ORG);
  return { ok: true as const };
});

export const persistEval = createServerFn({ method: "POST" }).handler(async () => {
  await boot();
  const report = runEvalSuite();
  await sql(
    `INSERT INTO eval_run (id, model_version, prompt_version, ndcg10, p_at_5, disqualifier_recall, rubric_p_at_5, naive_p_at_5, passed, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      nid("evl"),
      report.modelVersion,
      report.promptVersion,
      report.ndcg10,
      report.pAt5,
      report.disqualifierRecall,
      report.rubricPAt5,
      report.naivePAt5,
      report.passed,
      report.notes,
    ],
  );
  return report;
});

export { parseBrief };
