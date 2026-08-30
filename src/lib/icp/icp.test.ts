import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inheritRules } from "./engine.ts";
import type { Icp } from "@/lib/types";

const base: Icp = {
  title: "X",
  summary: "",
  must: ["backend"],
  nice: [],
  disqualifiers: [],
  locations: [],
  seniority: "senior",
  yearsMin: 5,
  yearsMax: 9,
  companyKinds: ["saas"],
  skills: ["Go"],
};

describe("icp inherit", () => {
  it("org rules prepend without dropping role criteria", () => {
    const merged = inheritRules(base, {
      must: ["product-company"],
      nice: ["talks"],
      disqualifiers: ["90-day notice"],
    });
    assert.deepEqual(merged.must, ["product-company", "backend"]);
    assert.ok(merged.disqualifiers.includes("90-day notice"));
  });

  it("null rules leave the ICP unchanged", () => {
    assert.equal(inheritRules(base, null), base);
  });
});
