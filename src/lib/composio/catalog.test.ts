import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { roleFromCategoryText, roleFromCategories, ROLE_NEEDLES } from "./catalog.ts";

describe("composio catalog roles", () => {
  it("maps Composio category text to runtime jobs without a slug allowlist", () => {
    assert.equal(roleFromCategoryText("AI Models"), "llm");
    assert.equal(roleFromCategoryText("generative ai"), "llm");
    assert.equal(roleFromCategoryText("Talent intelligence"), "sourcing");
    assert.equal(roleFromCategoryText("People search"), "sourcing");
    assert.equal(roleFromCategoryText("Applicant tracking"), "ats");
    assert.equal(roleFromCategoryText("Human resources"), "ats");
    assert.equal(roleFromCategoryText("Email"), "outreach");
    assert.equal(roleFromCategoryText("Communication"), "outreach");
    assert.equal(roleFromCategoryText("Project management"), null);
  });

  it("uses the first matching category on a toolkit", () => {
    assert.equal(roleFromCategories([{ name: "CRM" }, { slug: "ai-model", name: "AI Models" }]), "llm");
  });

  it("exposes needles per role rather than toolkit slugs", () => {
    assert.ok(ROLE_NEEDLES.llm.includes("chat"));
    assert.ok(ROLE_NEEDLES.sourcing.includes("people"));
    assert.ok(ROLE_NEEDLES.ats.includes("candidate"));
    assert.ok(ROLE_NEEDLES.outreach.includes("send"));
  });
});
