import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLANS } from "./meter.ts";

describe("billing plans", () => {
  it("never bundles agent runs into the seat", () => {
    for (const plan of Object.values(PLANS)) {
      assert.equal(plan.agentRuns, 0);
    }
  });
});
