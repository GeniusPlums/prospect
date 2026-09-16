import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catalogCursor,
  catalogListCursor,
  collectHiringCatalog,
  connectability,
  extractToolkitRows,
  hiringScanCategoryIds,
  mapToolkitRow,
  mergeHiringItems,
  roleFromCategories,
  roleFromCategoryText,
  summarizeCatalog,
  toHiringCatalogItem,
  toolkitLane,
  HIRING_PROBE_SLUGS,
  LANE_LABEL,
} from "./catalog.ts";

describe("composio catalog roles", () => {
  it("maps Composio category text to runtime jobs without a slug allowlist", () => {
    assert.equal(roleFromCategoryText("AI Models"), "llm");
    assert.equal(roleFromCategoryText("generative ai"), "llm");
    assert.equal(roleFromCategoryText("Talent intelligence"), "sourcing");
    assert.equal(roleFromCategoryText("People search"), "sourcing");
    assert.equal(roleFromCategoryText("CRM"), "sourcing");
    assert.equal(roleFromCategoryText("Sales intelligence"), "sourcing");
    assert.equal(roleFromCategoryText("Applicant tracking"), "ats");
    assert.equal(roleFromCategoryText("Human resources"), "ats");
    assert.equal(roleFromCategoryText("Email"), "outreach");
    assert.equal(roleFromCategoryText("Communication"), "outreach");
    assert.equal(roleFromCategoryText("Calendar"), "outreach");
    assert.equal(roleFromCategoryText("Project management"), null);
    assert.equal(roleFromCategoryText("Popular"), null);
    assert.equal(roleFromCategoryText("Developer Tools"), null);
  });

  it("uses the first matching hiring category on a toolkit", () => {
    assert.equal(roleFromCategories([{ name: "CRM" }]), "sourcing");
    assert.equal(roleFromCategories([{ name: "DevOps" }, { slug: "ai-model", name: "AI Models" }]), "llm");
  });

  it("includes ATS, LLM, mail, and people toolkits even when Composio files them under Popular", () => {
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
    assert.equal(toHiringCatalogItem({ slug: "outlook", label: "Outlook" })?.lane, "outreach");
    assert.equal(toHiringCatalogItem({ slug: "apollo", label: "Apollo" })?.lane, "sourcing");
    assert.equal(toHiringCatalogItem({ slug: "linkedin", label: "LinkedIn" })?.lane, "sourcing");
    assert.equal(toHiringCatalogItem({ slug: "hunter", label: "Hunter" })?.lane, "outreach");
    assert.equal(toHiringCatalogItem({ slug: "peopledatalabs", label: "People Data Labs" })?.lane, "sourcing");
    assert.equal(toHiringCatalogItem({ slug: "lever", label: "Lever" })?.lane, "ats");
    assert.equal(toHiringCatalogItem({ slug: "ashby", label: "Ashby" })?.lane, "ats");
    assert.equal(toHiringCatalogItem({ slug: "workday", label: "Workday" })?.lane, "ats");
    assert.equal(toHiringCatalogItem({ slug: "groq", label: "Groq" })?.lane, "llm");
    assert.equal(toHiringCatalogItem({ slug: "gemini", label: "Gemini" })?.lane, "llm");
    assert.equal(toHiringCatalogItem({ slug: "slack", label: "Slack" })?.lane, "outreach");
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

  it("treats empty oauth schemes plus api_key as connectable", () => {
    const apiKeyOnly = toHiringCatalogItem({
      slug: "apollo",
      label: "Apollo",
      managedAuth: [],
      authSchemes: ["API_KEY"],
    });
    assert.equal(apiKeyOnly?.connectable, true);
    assert.equal(apiKeyOnly?.connectError, undefined);
    const bearer = connectability({ managedAuth: [], authSchemes: ["BEARER_TOKEN"] });
    assert.equal(bearer.connectable, true);
    const hosted = toHiringCatalogItem({
      slug: "gmail",
      label: "Gmail",
      managedAuth: ["OAUTH2"],
    });
    assert.equal(hosted?.connectable, true);
    const emptyOauth = toHiringCatalogItem({
      slug: "greenhouse",
      label: "Greenhouse",
      managedAuth: [],
    });
    assert.equal(emptyOauth?.connectable, true);
    assert.notEqual(emptyOauth?.connectError, "No hosted OAuth for this tool");
  });

  it("scans hiring-adjacent and Popular categories but not DevOps", () => {
    assert.deepEqual(
      hiringScanCategoryIds([
        { id: "popular", name: "Popular" },
        { id: "developer-tools", name: "Developer Tools" },
        { id: "ai-models", name: "AI Models" },
        { id: "human-resources", name: "Human Resources" },
        { id: "crm", name: "CRM" },
      ]),
      ["popular", "ai-models", "human-resources", "crm"],
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
        if (query.category === "email") return page;
        return { items: [] };
      },
    });
    assert.ok(queries.every((query) => query.cursor === undefined));
    assert.ok(items.some((item) => item.slug === "gmail" && item.lane === "outreach"));
  });

  it("follows a real nextCursor from a paginated object", async () => {
    const queries: { category?: string; cursor?: string }[] = [];
    const items = await collectHiringCatalog({
      listCategories: async () => [{ id: "email", name: "Email" }],
      listPage: async (query) => {
        queries.push(query);
        if (query.category !== "email") return { items: [] };
        if (!query.cursor) {
          return { items: [{ slug: "gmail", name: "Gmail", meta: { categories: [{ name: "Email" }] } }], nextCursor: "page-2" };
        }
        return { items: [{ slug: "outlook", name: "Outlook", meta: { categories: [{ name: "Email" }] } }], nextCursor: null };
      },
    });
    assert.ok(queries.some((query) => query.category === "email" && query.cursor === "page-2"));
    assert.deepEqual(
      items.map((item) => item.slug).sort(),
      ["gmail", "outlook"],
    );
  });

  it("fails if a Coresignal-only merge would hide Apollo from the same fixture", async () => {
    const refs = [
      mapToolkitRow({
        slug: "coresignal",
        name: "Coresignal",
        composioManagedAuthSchemes: [],
        authSchemes: ["API_KEY"],
        meta: { categories: [{ name: "Talent intelligence" }] },
      }),
      mapToolkitRow({
        slug: "apollo",
        name: "Apollo",
        composioManagedAuthSchemes: [],
        authSchemes: ["API_KEY"],
        meta: { categories: [{ name: "CRM" }] },
      }),
      mapToolkitRow({
        slug: "debounce",
        name: "DeBounce",
        composioManagedAuthSchemes: [],
        authSchemes: ["API_KEY"],
        meta: { categories: [{ name: "Contact data" }] },
      }),
      mapToolkitRow({
        slug: "rocketreach",
        name: "RocketReach",
        composioManagedAuthSchemes: ["OAUTH2"],
        meta: { categories: [{ name: "Talent intelligence" }] },
      }),
    ].filter((row): row is NonNullable<typeof row> => Boolean(row));
    const items = mergeHiringItems(refs);
    const sourcing = items.filter((item) => item.lane === "sourcing").map((item) => item.slug);
    assert.ok(sourcing.includes("apollo"), "Apollo in the fixture must appear in sourcing");
    assert.ok(sourcing.length > 1, "Coresignal-only sourcing is a failure when Apollo exists");
    assert.ok(items.every((item) => item.connectable));
  });

  it("probes hiring slugs so Apollo and Gmail appear when the category page is Coresignal-only", async () => {
    assert.ok(HIRING_PROBE_SLUGS.includes("apollo"));
    assert.ok(HIRING_PROBE_SLUGS.includes("gmail"));
    const items = await collectHiringCatalog({
      listCategories: async () => [{ id: "talent-intelligence", name: "Talent intelligence" }],
      listPage: async (query) => {
        if (query.category !== "talent-intelligence") return { items: [] };
        return {
          items: [
            {
              slug: "coresignal",
              name: "Coresignal",
              composioManagedAuthSchemes: [],
              authSchemes: ["API_KEY"],
              meta: { categories: [{ name: "Talent intelligence" }] },
            },
            {
              slug: "debounce",
              name: "DeBounce",
              composioManagedAuthSchemes: [],
              authSchemes: ["API_KEY"],
              meta: { categories: [{ name: "Contact data" }] },
            },
            {
              slug: "rocketreach",
              name: "RocketReach",
              composioManagedAuthSchemes: ["OAUTH2"],
              meta: { categories: [{ name: "Talent intelligence" }] },
            },
          ],
        };
      },
      getToolkit: async (slug) => {
        if (slug === "apollo") {
          return {
            slug: "apollo",
            name: "Apollo",
            composioManagedAuthSchemes: [],
            authConfigDetails: [{ mode: "API_KEY" }],
            meta: { categories: [{ name: "CRM", slug: "crm" }] },
          };
        }
        if (slug === "gmail") {
          return {
            slug: "gmail",
            name: "Gmail",
            composioManagedAuthSchemes: ["OAUTH2"],
            meta: { categories: [{ name: "Email", slug: "email" }] },
          };
        }
        if (slug === "greenhouse") {
          return {
            slug: "greenhouse",
            name: "Greenhouse",
            composioManagedAuthSchemes: ["OAUTH2"],
            meta: { categories: [{ name: "Human Resources", slug: "human-resources" }] },
          };
        }
        if (slug === "openai") {
          return {
            slug: "openai",
            name: "OpenAI",
            composioManagedAuthSchemes: [],
            authConfigDetails: [{ mode: "API_KEY" }],
            meta: { categories: [{ name: "AI Models", slug: "ai-models" }] },
          };
        }
        throw new Error("not in this catalog");
      },
    });
    const summary = summarizeCatalog(items);
    assert.ok(items.some((item) => item.slug === "apollo" && item.lane === "sourcing" && item.connectable));
    assert.ok(items.some((item) => item.slug === "gmail" && item.lane === "outreach" && item.connectable));
    assert.ok(items.some((item) => item.slug === "greenhouse" && item.lane === "ats"));
    assert.ok(items.some((item) => item.slug === "openai" && item.lane === "llm"));
    assert.ok(summary.lanes.sourcing > 1);
    assert.ok(summary.connectable === summary.total);
  });
});

describe("live hiring catalog", () => {
  it("lists hiring lanes from the API when COMPOSIO_API_KEY is set", { skip: !process.env.COMPOSIO_API_KEY }, async () => {
    const { listHiringCatalog } = await import("./client.ts");
    const listed = await listHiringCatalog();
    assert.ok(listed.items.length > 0, "expected hiring tools from the live catalog");
    const summary = summarizeCatalog(listed.items);
    for (const item of listed.items) {
      assert.ok(["llm", "sourcing", "ats", "outreach"].includes(item.lane));
    }
    assert.ok(summary.lanes.llm + summary.lanes.sourcing + summary.lanes.ats + summary.lanes.outreach === summary.total);
    assert.ok(summary.connectable === summary.total, "listed tools must be connectable");
    const slugs = new Set(summary.slugs);
    if (slugs.has("apollo") || slugs.has("gmail") || slugs.has("openai") || slugs.has("greenhouse")) {
      assert.ok(summary.total > 3, "must not collapse to Coresignal/DeBounce/RocketReach when named hiring apps exist");
    }
  });
});
