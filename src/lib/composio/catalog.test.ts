import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catalogCursor,
  catalogListCursor,
  collectHiringCatalog,
  extractToolkitRows,
  hiringScanCategoryIds,
  mapToolkitRow,
  roleFromCategories,
  roleFromCategoryText,
  toHiringCatalogItem,
  toolkitLane,
  LANE_LABEL,
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

  it("marks tools without managed auth as not connectable", () => {
    const blocked = toHiringCatalogItem({
      slug: "greenhouse",
      label: "Greenhouse",
      managedAuth: [],
    });
    assert.equal(blocked?.connectable, false);
    assert.equal(blocked?.connectError, "No hosted OAuth for this tool");
    const hosted = toHiringCatalogItem({
      slug: "gmail",
      label: "Gmail",
      managedAuth: ["OAUTH2"],
    });
    assert.equal(hosted?.connectable, true);
  });

  it("scans hiring and Popular categories but not DevOps", () => {
    assert.deepEqual(
      hiringScanCategoryIds([
        { id: "popular", name: "Popular" },
        { id: "developer-tools", name: "Developer Tools" },
        { id: "ai-models", name: "AI Models" },
        { id: "human-resources", name: "Human Resources" },
      ]),
      ["popular", "ai-models", "human-resources"],
    );
  });

  it("does not treat a full SDK array as a cursor page keyed by the last slug", async () => {
    const queries: { category?: string; cursor?: string }[] = [];
    const page = Array.from({ length: 100 }, (_, index) => ({
      slug: index === 99 ? "gmail" : `app${index}`,
      name: index === 99 ? "Gmail" : `App ${index}`,
      meta: { categories: [{ name: "Email", slug: "email" }] },
    }));
    assert.equal(catalogCursor(page), null);
    assert.equal(catalogListCursor(page), null);
    const items = await collectHiringCatalog({
      listCategories: async () => [{ id: "email", name: "Email" }],
      listPage: async (query) => {
        queries.push(query);
        if (query.cursor) throw new Error("Failed to fetch toolkits");
        return page;
      },
    });
    assert.equal(queries.length, 1);
    assert.equal(queries[0]?.cursor, undefined);
    assert.ok(items.some((item) => item.slug === "gmail" && item.lane === "outreach"));
  });

  it("follows a real nextCursor from a paginated object", async () => {
    const queries: { category?: string; cursor?: string }[] = [];
    const items = await collectHiringCatalog({
      listCategories: async () => [{ id: "email", name: "Email" }],
      listPage: async (query) => {
        queries.push(query);
        if (!query.cursor) {
          return { items: [{ slug: "gmail", name: "Gmail", meta: { categories: [{ name: "Email" }] } }], nextCursor: "page-2" };
        }
        return { items: [{ slug: "outlook", name: "Outlook", meta: { categories: [{ name: "Email" }] } }], nextCursor: null };
      },
    });
    assert.equal(queries.length, 2);
    assert.equal(queries[1]?.cursor, "page-2");
    assert.deepEqual(
      items.map((item) => item.slug).sort(),
      ["gmail", "outlook"],
    );
  });
});

describe("live hiring catalog", () => {
  it("lists hiring lanes from the API when COMPOSIO_API_KEY is set", { skip: !process.env.COMPOSIO_API_KEY }, async () => {
    const { listHiringCatalog } = await import("./client.ts");
    const listed = await listHiringCatalog();
    assert.ok(listed.items.length > 0, "expected hiring tools from the live catalog");
    const lanes = new Set(listed.items.map((item) => item.lane));
    for (const item of listed.items) {
      assert.ok(["llm", "sourcing", "ats", "outreach"].includes(item.lane));
    }
    assert.ok(lanes.size >= 1);
  });
});
