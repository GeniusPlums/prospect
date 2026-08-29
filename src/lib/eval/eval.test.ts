import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ndcgAt, precisionAt, recall } from "./metrics.ts";
import { runEvalSuite } from "./run-eval.ts";

describe("eval metrics", () => {
  it("ndcg is 1 for a perfect list", () => {
    const rel = new Map([
      ["a", 3],
      ["b", 2],
    ]);
    assert.equal(ndcgAt(["a", "b"], rel, 2), 1);
  });

  it("precisionAt counts hits in k", () => {
    assert.equal(precisionAt(["a", "x", "b"], new Set(["a", "b"]), 3), 2 / 3);
  });

  it("recall is 1 when gold is empty", () => {
    assert.equal(recall(new Set(), new Set()), 1);
  });
});

describe("eval harness", () => {
  it("rubric beats naive on frozen golden sets", () => {
    const report = runEvalSuite();
    assert.ok(report.passed, report.notes);
    assert.ok(report.rubricPAt5 >= report.naivePAt5, report.notes);
  });
});
