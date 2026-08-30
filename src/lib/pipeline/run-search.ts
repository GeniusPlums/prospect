import { insertMany, sql, sqlOne } from "@/lib/db";
import { nid } from "@/lib/ids";
import { peopleSource } from "@/lib/adapters/registry";
import { cosine, embedText } from "@/lib/embed";
import { applyFeedbackRerank, proposeIcpDiff, runSearch } from "@/lib/ranking";
import { getIcp, proposeIcpDiffVersion, type StoredIcp } from "@/lib/icp/engine";
import { gradeCandidate } from "@/lib/scoring/grade-candidate";
import { recordUsage } from "@/lib/billing/meter";
import { MODEL_VERSIONS, PROMPT_VERSIONS } from "../../../prompts/versions.ts";
import type { FeedbackVote } from "@/lib/types";

export type PipelineEvent = { step: string; message: string; counts?: Record<string, number> };

async function emit(searchRunId: string, event: PipelineEvent) {
  await sql(
    `INSERT INTO pipeline_event (id, search_run_id, step, message, counts) VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [nid("evt"), searchRunId, event.step, event.message, JSON.stringify(event.counts ?? {})],
  );
}

async function cachedIds(orgId: string, externalIds: string[]): Promise<{ hits: string[]; misses: string[] }> {
  const rows = await sql<{ id: string }>(`SELECT id FROM candidate WHERE org_id=$1`, [orgId]);
  const have = new Set(rows.map((r) => r.id));
  return {
    hits: externalIds.filter((id) => have.has(id)),
    misses: externalIds.filter((id) => !have.has(id)),
  };
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

  const source = peopleSource();
  const hits = await source.search({ icp });
  const ids = hits.map((h) => h.externalId);

  const { hits: cacheHits, misses } = await cachedIds(run.org_id, ids);
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

  if (misses.length) {
    await emit(searchId, { step: "collect", message: `Collect ${misses.length} misses only` });
    await source.collect(misses);
    await recordUsage(run.org_id, "profile", misses.length);
    await sql(`UPDATE search_run SET profiles_charged=$2 WHERE id=$1`, [searchId, misses.length]);
  } else {
    await emit(searchId, { step: "collect", message: "Collect skipped — warm index hit 100%" });
  }

  await emit(searchId, { step: "stage1", message: "Hybrid retrieval → working set" });
  const queryVec = embedText([icp.title, icp.summary, ...icp.must, ...icp.skills].join(" "));
  const corpus = await sql<{ id: string; embedding: number[] | string }>(
    `SELECT id, embedding FROM candidate WHERE org_id=$1`,
    [run.org_id],
  );
  const hybrid = corpus
    .map((row) => {
      const vec = Array.isArray(row.embedding)
        ? row.embedding
        : typeof row.embedding === "string"
          ? (JSON.parse(row.embedding) as number[])
          : [];
      return { id: row.id, sim: cosine(queryVec, vec) };
    })
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 300);

  const graded = runSearch(icp, 22);
  const allowed = new Set(hybrid.map((h) => h.id));
  const shortlist = graded.filter((g) => allowed.has(g.candidateId) || allowed.size === 0);

  await emit(searchId, { step: "stage2", message: `Rubric grading ${shortlist.length} · prompt ${PROMPT_VERSIONS.gradeRubric}` });
  await emit(searchId, { step: "disqualifier", message: "Disqualifier pass (separate)" });

  const heldRules = icp.disqualifiers;
  const scoreRows: unknown[][] = [];
  const gradeRows: unknown[][] = [];
  const objectionRows: unknown[][] = [];

  for (const [i, row] of shortlist.entries()) {
    const detail = gradeCandidate(row.candidateId, icp);
    if (!detail) continue;
    const hard = row.disqualifiers.filter((d) =>
      heldRules.some(
        (r) => d.flag.toLowerCase().includes(r.slice(0, 8).toLowerCase()) || r.toLowerCase().includes(d.flag.toLowerCase()),
      ),
    );
    const heldBack =
      hard.length > 0 &&
      row.verdict === "flagged" &&
      row.disqualifiers.some(
        (d) => d.flag === "Services-only background" || d.flag === "Keyword-stuffed profile" || d.flag === "US-bound",
      );
    const scoreId = nid("scr");
    scoreRows.push([
      scoreId,
      searchId,
      row.candidateId,
      icp.id,
      MODEL_VERSIONS.heuristic,
      PROMPT_VERSIONS.gradeRubric,
      detail.caseFor,
      detail.caseAgainst,
      JSON.stringify(detail.unclear),
      row.verdict,
      detail.disqualified,
      JSON.stringify(row.disqualifiers),
      detail.forWeight,
      detail.againstWeight,
      detail.unclearWeight,
      i + 1,
      heldBack ? null : row.rank,
      heldBack,
      JSON.stringify(heldBack ? row.disqualifiers.map((d) => d.flag) : []),
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
  await emit(searchId, { step: "done", message: "Shortlist ready · zero enrichment spend" });
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
