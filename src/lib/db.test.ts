import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ensureDbReady, insertMany, sql } from "./db.ts";
import { nid } from "./ids.ts";

describe("insertMany", () => {
  it("no-ops on empty rows", async () => {
    await insertMany("INSERT INTO golden_set (id, name, brief_text, icp_snapshot) VALUES", []);
  });

  it("writes several rows in one statement", async () => {
    await ensureDbReady();
    const a = nid("gs");
    const b = nid("gs");
    await insertMany(
      `INSERT INTO golden_set (id, name, brief_text, icp_snapshot) VALUES`,
      [
        [a, "batch-a", "brief a", JSON.stringify({ title: "a" })],
        [b, "batch-b", "brief b", JSON.stringify({ title: "b" })],
      ],
      [undefined, undefined, undefined, "jsonb"],
    );
    const rows = await sql<{ n: string }>(
      `SELECT count(*)::text as n FROM golden_set WHERE id=$1 OR id=$2`,
      [a, b],
    );
    assert.equal(Number(rows[0]?.n ?? 0), 2);
  });
});
