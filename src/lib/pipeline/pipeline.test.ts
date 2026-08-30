import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ensureDbReady } from "@/lib/db";
import { writeIcpVersion } from "@/lib/icp/engine";
import { createAndRunSearch, createSearchRun, executeSearchRun } from "./run-search.ts";
import { sampleBriefs } from "@/lib/data/sample-briefs";
import { sql } from "@/lib/db";
import { DEV_ORG } from "@/lib/ids";

describe("pipeline", () => {
  it("cache-hits the warm index and does not collect", async () => {
    await ensureDbReady();
    const icp = await writeIcpVersion({
      roleKey: "payments-backend",
      icp: sampleBriefs[0]!.icp,
      authorType: "user",
    });
    const id = await createAndRunSearch({ orgId: DEV_ORG, icp, briefText: sampleBriefs[0]!.jd });
    const run = await sql<{ cache_hits: number; cache_misses: number; profiles_charged: number }>(
      `SELECT cache_hits, cache_misses, profiles_charged FROM search_run WHERE id=$1`,
      [id],
    );
    assert.ok((run[0]?.cache_hits ?? 0) > 0);
    assert.equal(run[0]?.cache_misses, 0);
    assert.equal(run[0]?.profiles_charged, 0);
    const objections = await sql<{ n: string }>(
      `SELECT count(*)::text as n FROM reviewer_objection o JOIN candidate_score s ON s.id=o.candidate_score_id WHERE s.search_run_id=$1`,
      [id],
    );
    assert.ok(Number(objections[0]?.n ?? 0) > 0);
  });

  it("createSearchRun does not score; execute is idempotent", async () => {
    await ensureDbReady();
    const icp = await writeIcpVersion({
      roleKey: "payments-backend-split",
      icp: sampleBriefs[0]!.icp,
      authorType: "user",
    });
    const id = await createSearchRun({ orgId: DEV_ORG, icp, briefText: sampleBriefs[0]!.jd });
    const created = await sql<{ status: string }>(`SELECT status FROM search_run WHERE id=$1`, [id]);
    assert.equal(created[0]?.status, "running");
    const before = await sql<{ n: string }>(
      `SELECT count(*)::text as n FROM candidate_score WHERE search_run_id=$1`,
      [id],
    );
    assert.equal(Number(before[0]?.n ?? 0), 0);
    await executeSearchRun(id);
    const done = await sql<{ status: string }>(`SELECT status FROM search_run WHERE id=$1`, [id]);
    assert.equal(done[0]?.status, "done");
    const scores = await sql<{ n: string }>(
      `SELECT count(*)::text as n FROM candidate_score WHERE search_run_id=$1`,
      [id],
    );
    const n = Number(scores[0]?.n ?? 0);
    assert.ok(n > 0);
    await executeSearchRun(id);
    const again = await sql<{ n: string }>(
      `SELECT count(*)::text as n FROM candidate_score WHERE search_run_id=$1`,
      [id],
    );
    assert.equal(Number(again[0]?.n ?? 0), n);
  });
});
