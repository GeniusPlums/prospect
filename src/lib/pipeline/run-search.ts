import { insertMany, sql, sqlOne } from "@/lib/db";
import { DEV_ORG, nid } from "@/lib/ids";
import { peopleSourceForOrg } from "@/lib/adapters/registry";
import { capCollect } from "@/lib/adapters/profile-source/people-query";
import { cosine, embedText } from "@/lib/embed";
import { applyFeedbackRerank, proposeIcpDiff } from "@/lib/ranking";
import { getIcp, proposeIcpDiffVersion, type StoredIcp } from "@/lib/icp/engine";
import { remaining, recordUsage } from "@/lib/billing/meter";
import { cachedIds, loadDossiers } from "@/lib/index/corpus";
import { persistCollected } from "@/lib/index/persist";
import { gradeDossiers } from "@/lib/ai/grade-dossiers";
import { MODEL_VERSIONS, PROMPT_VERSIONS } from "../../../prompts/versions.ts";
import type { FeedbackVote } from "@/lib/types";

export type PipelineEvent = { step: string; message: string; counts?: Record<string, number> };

/** Honest collect log. Empty search never claims a warm-index hit. */
export function collectSkipMessage(input: {
  cacheHits: number;
  cacheMisses: number;
  collected: number;
  quota: number;
  evalOnly: boolean;
}): string {
  if (input.collected > 0) return `Collect ${input.collected} cache misses`;
  if (input.cacheMisses > 0 && input.quota <= 0) return "Collect skipped — profile quota exhausted";
  if (input.cacheHits === 0 && input.cacheMisses === 0) {
    return "No people IDs from the connected toolkit — nothing to cache or collect";
  }
  if (input.evalOnly) return "Collect skipped — local eval index already had these IDs";
  return "Collect skipped — these IDs were already in your org cache";
}

async function emit(searchRunId: string, event: PipelineEvent) {
  await sql(
    `INSERT INTO pipeline_event (id, search_run_id, step, message, counts) VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [nid("evt"), searchRunId, event.step, event.message, JSON.stringify(event.counts ?? {})],
  );
}

export async function createSearchRun(input: {
  orgId: string;
  icp: StoredIcp;
  briefText: string;
}): Promise<string> {
  const searchId = nid("run");
  await sql(
    `INSERT INTO search_run (id, org_id, icp_version_id, status, brief_text) VALUES ($1,$2,$3,'running',$4)`,
    [searchId, input.orgId, input.icp.id, input.briefText],
  );
  await emit(searchId, { step: "search", message: "People search (IDs only, no collect credits)" });
  return searchId;
}

export async function executeSearchRun(searchId: string): Promise<string> {
  const run = await sqlOne<{ id: string; org_id: string; icp_version_id: string; status: string }>(
    `SELECT id, org_id, icp_version_id, status FROM search_run WHERE id=$1`,
    [searchId],
  );
  if (!run) throw new Error("Search not found");
  if (run.status === "done") return searchId;

  const already = await sqlOne<{ n: string }>(
    `SELECT count(*)::text as n FROM candidate_score WHERE search_run_id=$1`,
    [searchId],
  );
  if (Number(already?.n ?? 0) > 0) {
    await sql(`UPDATE search_run SET status='done', completed_at=coalesce(completed_at, now()) WHERE id=$1`, [
      searchId,
    ]);
    return searchId;
  }

  const icp = await getIcp(run.icp_version_id);
  if (!icp) throw new Error("ICP missing");

  const evalOnly = run.org_id === DEV_ORG;
  const source = await peopleSourceForOrg(run.org_id);
  await emit(searchId, {
    step: "search",
    message:
      source.name === "none"
        ? "Sourcing not connected — there is no list"
        : `Finding via ${source.name}`,
  });
  let hits: { externalId: string; cacheKey: string }[] = [];
  try {
    hits = source.name === "none" ? [] : await source.search({ icp });
  } catch (err) {
    await emit(searchId, {
      step: "search",
      message: err instanceof Error ? err.message : "People search failed",
    });
  }

  const ids = hits.map((h) => h.externalId);
  const { hits: cacheHits, misses } = await cachedIds(run.org_id, ids, evalOnly);
  await sql(`UPDATE search_run SET cache_hits=$2, cache_misses=$3 WHERE id=$1`, [
    searchId,
    cacheHits.length,
    misses.length,
  ]);
  await emit(searchId, {
    step: "cache",
    message: `Cache check · ${cacheHits.length} hits · ${misses.length} misses`,
    counts: { hits: cacheHits.length, misses: misses.length },
  });

  const quota = await remaining(run.org_id, "pro", "profile");
  const wantCollect = Math.max(0, 22 - cacheHits.length);
  const toCollect = misses.slice(0, capCollect(wantCollect, quota, 22));
  const candidateIds = cacheHits.map((row) => row.candidateId);

  let collectedCount = 0;
  if (toCollect.length) {
    const collected = await source.collect(toCollect);
    collectedCount = collected.length;
    const persisted = await persistCollected(run.org_id, collected, source.name);
    candidateIds.push(...persisted);
    await recordUsage(run.org_id, "profile", collected.length);
    await sql(`UPDATE search_run SET profiles_charged=$2 WHERE id=$1`, [searchId, collected.length]);
  }
  await emit(searchId, {
    step: "collect",
    message: collectSkipMessage({
      cacheHits: cacheHits.length,
      cacheMisses: misses.length,
      collected: collectedCount,
      quota,
      evalOnly,
    }),
    counts: { collect: collectedCount, spendProfiles: collectedCount },
  });
  if (collectedCount > 0) {
    await emit(searchId, {
      step: "spend",
      message: `Spend this run · ${collectedCount} profiles charged`,
      counts: { profiles: collectedCount },
    });
  }

  const uniqueIds = [...new Set(candidateIds)];
  if (uniqueIds.length === 0) {
    const message = evalOnly
      ? "No people in the eval index for this brief"
      : source.name === "none"
        ? "Sourcing not connected — there is no list"
        : `No one passed from ${source.name}. That is the result. We do not pad the list.`;
    await emit(searchId, { step: "done", message });
    await sql(`UPDATE search_run SET status='done', completed_at=now() WHERE id=$1`, [searchId]);
    return searchId;
  }

  await emit(searchId, { step: "stage1", message: "Rank collected dossiers only" });
  const queryVec = embedText([icp.title, icp.summary, ...icp.must, ...icp.skills].join(" "));
  const dossiers = await loadDossiers(uniqueIds);
  const ranked = dossiers
    .map((dossier) => ({ dossier, sim: cosine(queryVec, embedText(dossier.hay)) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 22)
    .map((row) => row.dossier);

  await emit(searchId, {
    step: "stage2",
    message: evalOnly
      ? `Heuristic grading ${ranked.length} · prompt ${PROMPT_VERSIONS.gradeRubric}`
      : `LLM grading ${ranked.length} · prompt ${PROMPT_VERSIONS.gradeRubric}`,
  });
  await emit(searchId, { step: "disqualifier", message: "Disqualifier pass (separate)" });

  const grades = await gradeDossiers({
    orgId: run.org_id,
    icp,
    dossiers: ranked,
    useLlm: !evalOnly,
  });
  const via = [...grades.values()].find((row) => row.modelVersion)?.modelVersion;
  if (!evalOnly && via === "groq-fallback") {
    await emit(searchId, {
      step: "llm",
      message: "Grading used Groq last-resort fallback — no LLM connected",
    });
  } else if (!evalOnly && via && via !== "heuristic.v1") {
    await emit(searchId, { step: "llm", message: `Grading via ${via}` });
  }

  const scoreRows: unknown[][] = [];
  const gradeRows: unknown[][] = [];
  const objectionRows: unknown[][] = [];

  for (const [i, dossier] of ranked.entries()) {
    const detail = grades.get(dossier.id);
    if (!detail) continue;
    const heldRules = icp.disqualifiers.filter((rule) =>
      detail.disqualifierFlags.some(
        (flag) =>
          flag.flag.toLowerCase().includes(rule.slice(0, 8).toLowerCase()) ||
          rule.toLowerCase().includes(flag.flag.toLowerCase()),
      ),
    );
    const heldBack = detail.verdict === "flagged" && heldRules.length > 0;
    const scoreId = nid("scr");
    const rank = i + 1;
    scoreRows.push([
      scoreId,
      searchId,
      dossier.id,
      icp.id,
      detail.modelVersion || MODEL_VERSIONS.heuristic,
      PROMPT_VERSIONS.gradeRubric,
      detail.caseFor,
      detail.caseAgainst,
      JSON.stringify(detail.unclear),
      detail.verdict,
      detail.disqualified,
      JSON.stringify(detail.disqualifierFlags),
      detail.forWeight,
      detail.againstWeight,
      detail.unclearWeight,
      rank,
      heldBack ? null : rank,
      heldBack,
      JSON.stringify(heldBack ? heldRules : []),
    ]);
    for (const g of detail.criterionGrades) {
      gradeRows.push([nid("grd"), scoreId, g.criterionId, g.grade, g.evidence]);
    }
    for (const obj of detail.reviewerObjections) {
      objectionRows.push([nid("obj"), scoreId, obj.claim, obj.objection]);
    }
  }

  await insertMany(
    `INSERT INTO candidate_score (
        id, search_run_id, candidate_id, icp_version_id, model_version, prompt_version,
        case_for, case_against, unclear, verdict, disqualified, disqualifier_flags,
        for_weight, against_weight, unclear_weight, stage1_rank, final_rank, held_back, held_back_rules
      ) VALUES`,
    scoreRows,
    [
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "jsonb",
      undefined,
      undefined,
      "jsonb",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "jsonb",
    ],
  );
  await insertMany(
    `INSERT INTO criterion_grade (id, candidate_score_id, criterion_id, grade, evidence) VALUES`,
    gradeRows,
  );
  await insertMany(
    `INSERT INTO reviewer_objection (id, candidate_score_id, claim, objection) VALUES`,
    objectionRows,
  );

  await emit(searchId, { step: "reviewer", message: "Reviewer objections posted (rank unchanged)" });
  await emit(searchId, { step: "done", message: `Shortlist ready · ${ranked.length} people` });
  await sql(`UPDATE search_run SET status='done', completed_at=now() WHERE id=$1`, [searchId]);
  return searchId;
}

export async function createAndRunSearch(input: {
  orgId: string;
  icp: StoredIcp;
  briefText: string;
}): Promise<string> {
  const searchId = await createSearchRun(input);
  return executeSearchRun(searchId);
}

export async function rerankFromStage1(searchRunId: string, feedback: Record<string, FeedbackVote>) {
  const run = await sql<{ icp_version_id: string; org_id: string }>(`SELECT icp_version_id, org_id FROM search_run WHERE id=$1`, [searchRunId]);
  const icp = await getIcp(run[0]!.icp_version_id);
  if (!icp) return;
  const existing = await sql<{ candidate_id: string; final_rank: number | null; id: string }>(
    `SELECT id, candidate_id, final_rank FROM candidate_score WHERE search_run_id=$1 AND held_back = false`,
    [searchRunId],
  );
  const asGraded = existing
    .filter((e) => e.final_rank != null)
    .map((e) => ({
      candidateId: e.candidate_id,
      rank: e.final_rank!,
      verdict: "mixed" as const,
      caseFor: "",
      caseAgainst: "",
      unclear: [] as string[],
      disqualifiers: [],
      reviewerObjections: [],
      score: 100 - (e.final_rank ?? 50),
    }));
  const next = applyFeedbackRerank(asGraded, feedback);
  for (const row of next) {
    await sql(`UPDATE candidate_score SET final_rank=$3 WHERE search_run_id=$1 AND candidate_id=$2`, [
      searchRunId,
      row.candidateId,
      row.rank,
    ]);
  }
}

export async function applyFeedback(searchRunId: string, candidateId: string, vote: FeedbackVote) {
  await sql(
    `INSERT INTO feedback (search_run_id, candidate_id, vote, tags) VALUES ($1,$2,$3,$4::jsonb)
     ON CONFLICT (search_run_id, candidate_id) DO UPDATE SET vote=$3, tags=$4::jsonb`,
    [searchRunId, candidateId, vote.vote, JSON.stringify(vote.tags)],
  );
  const all = await sql<{ candidate_id: string; vote: "up" | "down"; tags: string[] }>(
    `SELECT candidate_id, vote, tags FROM feedback WHERE search_run_id=$1`,
    [searchRunId],
  );
  const map: Record<string, FeedbackVote> = {};
  for (const row of all) {
    map[row.candidate_id] = { vote: row.vote, tags: Array.isArray(row.tags) ? row.tags : [] };
  }
  await rerankFromStage1(searchRunId, map);

  const run = await sql<{ icp_version_id: string }>(`SELECT icp_version_id FROM search_run WHERE id=$1`, [searchRunId]);
  const parent = await getIcp(run[0]!.icp_version_id);
  if (!parent || vote.vote !== "down" || !vote.tags[0]) return null;
  const diff = proposeIcpDiff(parent, vote.tags[0]);
  if (!diff) return null;
  return proposeIcpDiffVersion({
    parent,
    addMust: diff.addMust,
    addDisqualifiers: diff.addDisqualifiers,
    note: diff.note,
  });
}
