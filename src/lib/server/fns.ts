import { createServerFn } from "@tanstack/react-start";
import { ensureDbReady, sql } from "@/lib/db";
import { writeIcpVersion, getIcp, acceptIcpVersion, writeOrgRules, currentOrgRules } from "@/lib/icp/engine";
import { createSearchRun, executeSearchRun, applyFeedback } from "@/lib/pipeline/run-search";
import { parseBrief } from "@/lib/ai/parse-brief";
import { sampleBriefs } from "@/lib/data/sample-briefs";
import { revealContact, draftGroundedOutreach, sendOutreach } from "@/lib/reveal/reveal";
import { screenResume } from "@/lib/screen/inbox";
import { syncMerge, writeAts } from "@/lib/ats/merge";
import { cacheHitRate, criteriaContradiction, ensureDefaultAutomations, fireAlwaysOn, precisionOverTime } from "@/lib/ops/dashboard";
import { remaining, usageInCycle, pushAddonsForCycle } from "@/lib/billing/meter";
import { runEvalSuite } from "@/lib/eval/run-eval";
import { nid } from "@/lib/ids";
import { requireOrg } from "@/lib/auth/session";
import { loadPeople } from "@/lib/index/corpus";
import {
  composioConfigured,
  laneCanRun,
  listHiringCatalog,
  startConnect,
  syncOrgConnections,
} from "@/lib/composio/client";
import { LANE_LABEL, LANE_ORDER } from "@/lib/composio/catalog";
import type { Icp, FeedbackVote } from "@/lib/types";

async function boot() {
  await ensureDbReady();
}

async function org() {
  await boot();
  return requireOrg();
}

export const startFromBrief = createServerFn({ method: "POST" })
  .validator((input: { text: string; sampleId?: string; icp?: Icp }) => input)
  .handler(async ({ data }) => {
    const session = await org().catch(() => null);
    if (!session) return { ok: false as const, error: "Sign in required" };
    const sample = sampleBriefs.find((s) => s.id === data.sampleId || s.jd.trim() === data.text.trim());
    let icp: Icp;
    if (data.icp) icp = data.icp;
    else if (sample) icp = sample.icp;
    else {
      const parsed = await parseBrief({ data: { text: data.text } });
      if (!parsed.ok) return { ok: false as const, error: parsed.error };
      icp = parsed.icp;
    }
    const sourcing = await laneCanRun(session.orgId, "sourcing");
    if (!sourcing.ok) {
      return {
        ok: false as const,
        error: sourcing.error || "Connect a people source on Connections before searching.",
      };
    }
    const stored = await writeIcpVersion({
      orgId: session.orgId,
      roleKey: sample?.id ?? "custom",
      icp,
      authorType: "user",
    });
    const searchId = await createSearchRun({
      orgId: session.orgId,
      icp: stored,
      briefText: data.text,
    });
    return { ok: true as const, searchId, icp: stored };
  });

export const runSearchPipeline = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await org().catch(() => null);
    if (!session) return { ok: false as const, error: "Sign in required" };
    const run = await sql<{ org_id: string }>(`SELECT org_id FROM search_run WHERE id=$1`, [data.id]);
    if (!run[0] || run[0].org_id !== session.orgId) return { ok: false as const, error: "Search not found" };
    await executeSearchRun(data.id);
    return { ok: true as const };
  });

export const loadSearch = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await boot();
    const session = await requireOrg().catch(() => null);
    const run = await sql<{
      id: string;
      org_id: string;
      status: string;
      icp_version_id: string;
      brief_text: string;
      cache_hits: number;
      cache_misses: number;
      profiles_charged: number;
      created_at: string;
    }>(
      `SELECT id, org_id, status, icp_version_id, brief_text, cache_hits, cache_misses, profiles_charged, created_at FROM search_run WHERE id=$1`,
      [data.id],
    );
    if (!run[0]) return { ok: false as const };
    if (session && run[0].org_id !== session.orgId) return { ok: false as const };
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
    const people = await loadPeople(scores.map((row) => row.candidate_id));
    const [ats, outreach] = await Promise.all([
      laneCanRun(run[0].org_id, "ats"),
      laneCanRun(run[0].org_id, "outreach"),
    ]);
    return {
      ok: true as const,
      run: run[0],
      icp,
      events,
      scores,
      objections,
      feedback,
      reveals,
      people,
      gates: {
        reveal: outreach.ok,
        send: outreach.ok,
        ats: ats.ok,
      },
    };
  });

export const voteCandidate = createServerFn({ method: "POST" })
  .validator((input: { searchId: string; candidateId: string; vote: FeedbackVote }) => input)
  .handler(async ({ data }) => {
    await org();
    const proposed = await applyFeedback(data.searchId, data.candidateId, data.vote);
    return { ok: true as const, proposed };
  });

export const acceptProposedIcp = createServerFn({ method: "POST" })
  .validator((input: { icpId: string }) => input)
  .handler(async ({ data }) => {
    await org();
    await acceptIcpVersion(data.icpId);
    return { ok: true as const };
  });

export const doReveal = createServerFn({ method: "POST" })
  .validator((input: { searchId: string; candidateId: string }) => input)
  .handler(async ({ data }) => {
    const session = await org();
    return revealContact({ orgId: session.orgId, searchRunId: data.searchId, candidateId: data.candidateId });
  });

export const loadOutreach = createServerFn({ method: "GET" })
  .validator((input: { searchId: string; candidateId: string }) => input)
  .handler(async ({ data }) => {
    await org();
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
    const session = await org();
    return sendOutreach({
      orgId: session.orgId,
      searchRunId: data.searchId,
      candidateId: data.candidateId,
      to: data.to,
      subject: data.subject,
      body: data.body,
      facts: data.facts,
    });
  });

export const listSearches = createServerFn({ method: "GET" }).handler(async () => {
  const session = await org().catch(() => null);
  if (!session) return [];
  return sql<{ id: string; status: string; created_at: string; title: string; cache_hits: number; cache_misses: number; icp_version_id: string }>(
    `SELECT r.id, r.status, r.created_at, i.title, r.cache_hits, r.cache_misses, r.icp_version_id
     FROM search_run r JOIN icp_version i ON i.id = r.icp_version_id
     WHERE r.org_id=$1
     ORDER BY r.created_at DESC LIMIT 40`,
    [session.orgId],
  );
});

export const dashboard = createServerFn({ method: "GET" }).handler(async () => {
  const session = await org().catch(() => null);
  const orgId = session?.orgId;
  if (!orgId) {
    return {
      precision: [],
      cache: { hits: 0, misses: 0, rate: null as number | null },
      insight: { visible: false, body: null as string | null },
      automations: [],
      evals: [],
      remaining: { profiles: 0, reveals: 0 },
      used: { profiles: 0, reveals: 0 },
    };
  }
  const [precision, cache, insight, automations, evals, usage] = await Promise.all([
    precisionOverTime(orgId),
    cacheHitRate(orgId),
    criteriaContradiction(orgId),
    ensureDefaultAutomations(orgId),
    sql<{ id: string; p_at_5: number; ndcg10: number; passed: boolean; created_at: string; notes: string }>(
      `SELECT id, p_at_5, ndcg10, passed, created_at, notes FROM eval_run ORDER BY created_at DESC LIMIT 8`,
    ),
    Promise.all([
      remaining(orgId, "pro", "profile"),
      remaining(orgId, "pro", "reveal"),
      usageInCycle(orgId, "profile"),
      usageInCycle(orgId, "reveal"),
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
  const session = await org();
  const cycle = new Date();
  cycle.setUTCDate(cycle.getUTCDate() + 2);
  const label = `${cycle.getUTCFullYear()}-${String(cycle.getUTCMonth() + 1).padStart(2, "0")}`;
  await pushAddonsForCycle(session.orgId, "sub_local", label);
  return { ok: true as const };
});

export const screen = createServerFn({ method: "POST" })
  .validator((input: { icpId: string; resumeText: string }) => input)
  .handler(async ({ data }) => {
    const session = await org();
    return screenResume({ orgId: session.orgId, icpVersionId: data.icpId, resumeText: data.resumeText });
  });

export const connectAts = createServerFn({ method: "POST" }).handler(async () => {
  const session = await org();
  const id = await syncMerge(session.orgId);
  const people = await sql<{ id: string; name: string; stage: string; outcome: string | null }>(
    `SELECT id, name, stage, outcome FROM ats_person WHERE ats_connection_id=$1 ORDER BY name`,
    [id],
  );
  return { id, people };
});

export const atsWrite = createServerFn({ method: "POST" })
  .validator((input: { candidateId: string }) => input)
  .handler(async ({ data }) => {
    const session = await org();
    return writeAts(session.orgId, data.candidateId, "add_to_job", { stage: "sourced" });
  });

export const saveRules = createServerFn({ method: "POST" })
  .validator((input: { must: string[]; nice: string[]; disqualifiers: string[] }) => input)
  .handler(async ({ data }) => {
    const session = await org();
    const id = await writeOrgRules({ orgId: session.orgId, ...data });
    return { id, current: await currentOrgRules(session.orgId) };
  });

export const loadRules = createServerFn({ method: "GET" }).handler(async () => {
  const session = await org().catch(() => null);
  if (!session) return null;
  return currentOrgRules(session.orgId);
});

export const tickAlwaysOn = createServerFn({ method: "POST" }).handler(async () => {
  const session = await org();
  await fireAlwaysOn(session.orgId);
  return { ok: true as const };
});

export const persistEval = createServerFn({ method: "POST" }).handler(async () => {
  await org();
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

export const listConnections = createServerFn({ method: "GET" }).handler(async () => {
  const session = await org().catch(() => null);
  const lanes = LANE_ORDER.map((id) => ({ id, name: LANE_LABEL[id] }));
  if (!session) {
    return {
      ok: false as const,
      error: "Sign in required",
      configured: composioConfigured(),
      sourcingConnected: false,
      lanes,
      connections: [] as { toolkit: string; status: string; connected_account_id: string }[],
    };
  }
  const connections = await syncOrgConnections(session.orgId);
  const sourcing = await laneCanRun(session.orgId, "sourcing");
  return {
    ok: true as const,
    configured: composioConfigured(),
    sourcingConnected: sourcing.ok,
    lanes,
    connections,
  };
});

export const listToolkitCatalog = createServerFn({ method: "GET" }).handler(async () => {
  await org();
  if (!composioConfigured()) {
    return {
      ok: false as const,
      error: "COMPOSIO_API_KEY is not set",
      items: [] as Awaited<ReturnType<typeof listHiringCatalog>>["items"],
    };
  }
  try {
    const listed = await listHiringCatalog();
    return { ok: true as const, items: listed.items };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Could not load your tools",
      items: [] as Awaited<ReturnType<typeof listHiringCatalog>>["items"],
    };
  }
});

export const searchReadiness = createServerFn({ method: "GET" }).handler(async () => {
  const session = await org().catch(() => null);
  const empty = {
    sourcingConnected: false,
    llmConnected: false,
    atsConnected: false,
    outreachConnected: false,
    sourcingToolkit: null as string | null,
    sourcingError: null as string | null,
    llmError: null as string | null,
  };
  if (!session) return { ok: false as const, ...empty };
  const [sourcing, llm, ats, outreach] = await Promise.all([
    laneCanRun(session.orgId, "sourcing"),
    laneCanRun(session.orgId, "llm"),
    laneCanRun(session.orgId, "ats"),
    laneCanRun(session.orgId, "outreach"),
  ]);
  return {
    ok: true as const,
    sourcingConnected: sourcing.ok,
    llmConnected: llm.ok,
    atsConnected: ats.ok,
    outreachConnected: outreach.ok,
    sourcingToolkit: sourcing.ok ? sourcing.toolkit ?? null : null,
    sourcingError: sourcing.ok ? null : sourcing.error,
    llmError: llm.ok ? null : llm.error,
  };
});

export const connectToolkit = createServerFn({ method: "POST" })
  .validator((input: { toolkit: string; origin: string }) => input)
  .handler(async ({ data }) => {
    const session = await org();
    const callbackUrl = `${data.origin.replace(/\/$/, "")}/connections?connected=1`;
    return startConnect(session.orgId, data.toolkit, callbackUrl);
  });

export const whoami = createServerFn({ method: "GET" }).handler(async () => {
  await boot();
  try {
    const session = await requireOrg();
    return { ok: true as const, email: session.email, name: session.name, orgId: session.orgId };
  } catch {
    return { ok: false as const };
  }
});

export { parseBrief };
