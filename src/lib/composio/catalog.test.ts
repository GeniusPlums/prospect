import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractToolkitRows,
  mapToolkitRow,
  roleFromCategories,
  roleFromCategoryText,
  toHiringCatalogItem,
  toolkitLane,
  LANE_LABEL,
  ROLE_NEEDLES,
} from "./catalog.ts";

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
    assert.equal(roleFromCategoryText("Popular"), null);
    assert.equal(roleFromCategoryText("Developer Tools"), null);
  });

  it("uses the first matching hiring category on a toolkit", () => {
    assert.equal(roleFromCategories([{ name: "CRM" }, { slug: "ai-model", name: "AI Models" }]), "llm");
  });

  it("includes ATS and LLM toolkits even when Composio files them under Popular", () => {
    assert.equal(
      toolkitLane({
        slug: "greenhouse",
        label: "Greenhouse",
        categories: [{ name: "Popular", slug: "popular" }, { name: "Human Resources", slug: "human-resources" }],
      }),
      "ats",
    );
    assert.equal(
      toolkitLane({
        slug: "openai",
        label: "OpenAI",
        categories: [{ name: "Popular", slug: "popular" }, { name: "AI Models", slug: "ai-models" }],
      }),
      "llm",
    );
    assert.equal(toHiringCatalogItem({ slug: "anthropic", label: "Anthropic" })?.lane, "llm");
    assert.equal(toHiringCatalogItem({ slug: "gmail", label: "Gmail" })?.lane, "outreach");
    assert.equal(toHiringCatalogItem({ slug: "apollo", label: "Apollo" })?.lane, "sourcing");
    assert.equal(toHiringCatalogItem({ slug: "hunter", label: "Hunter" })?.lane, "outreach");
    assert.equal(LANE_LABEL.llm, "LLM");
    assert.equal(LANE_LABEL.ats, "ATS / HRIS");
    assert.equal(LANE_LABEL.outreach, "Outreach / mail");
  });

  it("excludes devops-like slugs even if Popular is the first category", () => {
    assert.equal(
      toolkitLane({
        slug: "github",
        label: "GitHub",
        categories: [{ name: "Popular", slug: "popular" }, { name: "Developer Tools", slug: "developer-tools" }],
      }),
      null,
    );
    assert.equal(toHiringCatalogItem({ slug: "docker", label: "Docker" }), null);
    assert.equal(toHiringCatalogItem({ slug: "kubernetes", label: "Kubernetes" }), null);
    assert.equal(extractToolkitRows({ items: [{ slug: "github" }, { slug: "greenhouse" }] }).length, 2);
  });

  it("does not treat a single toolkit retrieve or category pills as a catalog list", () => {
    assert.deepEqual(extractToolkitRows({ slug: "github", name: "GitHub" }), []);
    assert.deepEqual(extractToolkitRows({ name: "Popular", id: "popular" }), []);
    const rows = extractToolkitRows({
      items: [
        { slug: "openai", name: "OpenAI", meta: { categories: [{ name: "AI Models", slug: "ai-models" }] } },
        { slug: "github", name: "GitHub", meta: { categories: [{ name: "Popular", slug: "popular" }] } },
      ],
    });
    const hiring = rows.map(mapToolkitRow).map((row) => (row ? toHiringCatalogItem(row) : null)).filter(Boolean);
    assert.equal(hiring.length, 1);
    assert.equal(hiring[0]?.slug, "openai");
  });

  it("exposes needles per role rather than toolkit slugs", () => {
    assert.ok(ROLE_NEEDLES.llm.includes("chat"));
    assert.ok(ROLE_NEEDLES.sourcing.includes("people"));
    assert.ok(ROLE_NEEDLES.ats.includes("candidate"));
    assert.ok(ROLE_NEEDLES.outreach.includes("send"));
  });
});
