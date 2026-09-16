export type CatalogItem = {
  slug: string;
  label: string;
  blurb: string;
  category: string;
  lane: RuntimeRole;
  connectable: boolean;
  connectError?: string;
};

export type CatalogCategory = { id: string; name: string };

export type RuntimeRole = "llm" | "sourcing" | "ats" | "outreach";

export type ToolkitRef = {
  slug: string;
  label?: string;
  blurb?: string;
  category?: string;
  categories?: { name?: string; slug?: string; id?: string }[];
  noAuth?: boolean;
  managedAuth?: string[];
  authSchemes?: string[];
  authModes?: string[];
};

export const LANE_ORDER: RuntimeRole[] = ["llm", "sourcing", "ats", "outreach"];

export const LANE_LABEL: Record<RuntimeRole, string> = {
  llm: "LLM",
  sourcing: "Sourcing / people",
  ats: "ATS / HRIS",
  outreach: "Outreach / mail",
};

/**
 * Known hiring apps to retrieve by slug when category paging misses them.
 * Not a runtime allowlist — if retrieve 404s, the name simply is not in this catalog.
 */
export const HIRING_PROBE_SLUGS = [
  "openai",
  "anthropic",
  "groq",
  "gemini",
  "google_gemini",
  "claude",
  "apollo",
  "linkedin",
  "hunter",
  "pdl",
  "peopledatalabs",
  "people_data_labs",
  "coresignal",
  "rocketreach",
  "debounce",
  "zoominfo",
  "lusha",
  "clearbit",
  "gmail",
  "outlook",
  "microsoft_outlook",
  "slack",
  "googlecalendar",
  "google_calendar",
  "greenhouse",
  "lever",
  "ashby",
  "workday",
] as const;

/** Map category names/slugs to a runtime job. Prefer showing hiring-adjacent tools. */
export function roleFromCategoryText(text: string): RuntimeRole | null {
  const t = text.toLowerCase().replace(/[_-]/g, " ");
  if (isNoiseCategoryText(t)) return null;
  if (/\bai\b|\bllm\b|language model|generative|openai|anthropic|machine learning|chat models?/.test(t)) return "llm";
  if (
    /talent intelligence|people data|people search|contact data|\bsourcing\b|recruiting data|enrichment|\bcrm\b|sales intelligence|lead generation|prospecting/.test(
      t,
    )
  ) {
    return "sourcing";
  }
  if (/\bats\b|applicant|hris|human resources?|\bhr\b|recruiting|talent acquisition/.test(t)) return "ats";
  if (/\bemail\b|\bmail\b|inbox|messaging|communication|outreach|calendar|scheduling|\bsocial\b/.test(t)) {
    return "outreach";
  }
  return null;
}

export function isNoiseCategoryText(text: string): boolean {
  const t = text.toLowerCase().replace(/[_-]/g, " ");
  return /\bpopular\b|\btrending\b|\bfeatured\b|\bdevops\b|developer tools?|\bcloud\b|\bdatabases?\b|infrastructure|engineering tools?|project management/.test(
    t,
  );
}

export function roleFromCategories(categories: { name?: string; slug?: string; id?: string }[]): RuntimeRole | null {
  for (const category of categories) {
    const hit = roleFromCategoryText(`${category.slug ?? category.id ?? ""} ${category.name ?? ""}`);
    if (hit) return hit;
  }
  return null;
}

export function haystack(ref: ToolkitRef): string {
  const cats = (ref.categories ?? []).map((c) => `${c.slug ?? c.id ?? ""} ${c.name ?? ""}`).join(" ");
  return [ref.slug, ref.label, ref.blurb, ref.category, cats].filter(Boolean).join(" ").toLowerCase().replace(/[_-]+/g, " ");
}

const EXCLUDE =
  /\b(devops|kubernetes|\bk8s\b|docker|terraform|ansible|jenkins|circleci|github|gitlab|bitbucket|\baws\b|amazon web|google cloud|\bgcp\b|azure devops|postgres|postgresql|mysql|mongodb|\bredis\b|snowflake|bigquery|dynamodb|cassandra|elasticsearch|\bkafka\b|prometheus|grafana|datadog|sentry|pagerduty|\bjira\b|linear app|\basana\b|trello|confluence|\bfigma\b|stripe|shopify|\bvercel\b|netlify|heroku|cloudflare|\bnginx\b)\b/;

function laneFromKeywords(text: string): RuntimeRole | null {
  if (
    /\b(openai|anthropic|claude|groq|gemini|mistral|together ai|fireworks|perplexity|hugging ?face|cohere|vertex ai|bedrock|deepseek|ollama|openrouter|cerebras|\bgrok\b|\bxai\b|google ai|google gemini|ai studio|language model|\bllm\b|generative ai|ai models?|chatgpt)\b/.test(
      text,
    )
  ) {
    return "llm";
  }
  if (
    /\b(greenhouse|lever|ashby|workday|bamboo ?hr|workable|jobvite|icims|smartrecruiters|bullhorn|jazz ?hr|breezy|recruitee|teamtailor|rippling|gusto|hibob|hi bob|personio|successfactors|taleo|applicant tracking|\bats\b|\bhris\b|human resources?)\b/.test(
      text,
    )
  ) {
    return "ats";
  }
  if (
    /\b(apollo|linkedin|people data labs|peopledatalabs|\bpdl\b|coresignal|zoominfo|lusha|contactout|rocketreach|clearbit|fullenrich|dropcontact|proxycurl|snov|cognism|hireez|seekout|debounce|people search|talent intel|contact data|people data)\b/.test(
      text,
    )
  ) {
    return "sourcing";
  }
  if (
    /\b(gmail|outlook|office 365|microsoft 365|microsoft outlook|\bslack\b|microsoft teams|sendgrid|mailgun|postmark|twilio|whatsapp|resend|\binbox\b|\bhunter\b|email finder|google calendar|googlecalendar)\b/.test(
      text,
    )
  ) {
    return "outreach";
  }
  return null;
}

/** Hiring lane for a toolkit. Keywords beat a misleading first category like Popular. */
export function toolkitLane(ref: ToolkitRef): RuntimeRole | null {
  if (!ref.slug) return null;
  const text = haystack(ref);
  const fromName = laneFromKeywords(text);
  if (fromName) return fromName;
  if (EXCLUDE.test(text)) return null;
  const fromCats = roleFromCategories(ref.categories ?? []);
  if (fromCats) return fromCats;
  if (ref.category) return roleFromCategoryText(ref.category);
  return null;
}

const CONNECTABLE_SCHEME =
  /oauth|api[_]?key|bearer|basic|no[_]?auth|composio[_]?managed|managed[_]?auth|dcr|s2s|calcom|saml|service[_]?account/i;

export function isConnectableScheme(value: string): boolean {
  return CONNECTABLE_SCHEME.test(value.replace(/[\s-]+/g, "_"));
}

/**
 * SDK list items expose `authSchemes` + `composioManagedAuthSchemes`.
 * Retrieve exposes `composioManagedAuthSchemes` + `authConfigDetails[].mode`.
 * Empty hosted-OAuth array is not a dead end — API_KEY / BEARER still connect.
 */
export function connectability(ref: {
  noAuth?: boolean;
  managedAuth?: string[];
  authSchemes?: string[];
  authModes?: string[];
}): { connectable: boolean; connectError?: string } {
  if (ref.noAuth) return { connectable: true };
  const schemes = [...(ref.managedAuth ?? []), ...(ref.authSchemes ?? []), ...(ref.authModes ?? [])];
  if (schemes.some(isConnectableScheme)) return { connectable: true };
  return { connectable: true };
}

export function toHiringCatalogItem(ref: ToolkitRef): CatalogItem | null {
  const lane = toolkitLane(ref);
  if (!lane) return null;
  const auth = connectability(ref);
  return {
    slug: ref.slug,
    label: ref.label || ref.slug,
    blurb: ref.blurb ?? "",
    category: LANE_LABEL[lane],
    lane,
    connectable: auth.connectable,
    connectError: auth.connectError,
  };
}

export function extractToolkitRows(listed: unknown): Record<string, unknown>[] {
  if (Array.isArray(listed)) return listed.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  if (!listed || typeof listed !== "object") return [];
  const rec = listed as Record<string, unknown>;
  if (Array.isArray(rec.items)) {
    return rec.items.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  }
  return [];
}

export function catalogCursor(page: unknown): string | null {
  if (!page || typeof page !== "object" || Array.isArray(page)) return null;
  const rec = page as Record<string, unknown>;
  const value = rec.nextCursor ?? rec.next_cursor;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** SDK `toolkits.get({})` returns an array and drops next_cursor — never page with a slug. */
export function catalogListCursor(listed: unknown): string | null {
  return catalogCursor(listed);
}

export function isPopularScanCategory(text: string): boolean {
  const t = text.toLowerCase().replace(/[_-]/g, " ");
  return /\bpopular\b|\btrending\b|\bfeatured\b/.test(t);
}

/** Category ids to fetch. Popular is scanned for named hiring apps; DevOps is not. */
export function hiringScanCategoryIds(categories: CatalogCategory[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const category of categories) {
    if (!category.id) continue;
    const text = `${category.id} ${category.name}`;
    if (!roleFromCategoryText(text) && !isPopularScanCategory(text)) continue;
    if (seen.has(category.id)) continue;
    seen.add(category.id);
    ids.push(category.id);
  }
  return ids;
}

export const FALLBACK_HIRING_CATEGORY_IDS = [
  "ai-models",
  "human-resources",
  "email",
  "communication",
  "crm",
  "productivity",
  "calendar",
  "social",
  "sales",
];

export function refsFromToolkitList(listed: unknown): ToolkitRef[] {
  return extractToolkitRows(listed)
    .map(mapToolkitRow)
    .filter((row): row is ToolkitRef => Boolean(row));
}

export function mergeHiringItems(refs: ToolkitRef[]): CatalogItem[] {
  const seen = new Map<string, CatalogItem>();
  for (const ref of refs) {
    const item = toHiringCatalogItem(ref);
    if (item) seen.set(item.slug, item);
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function summarizeCatalog(items: CatalogItem[]) {
  const lanes: Record<RuntimeRole, number> = { llm: 0, sourcing: 0, ats: 0, outreach: 0 };
  for (const item of items) lanes[item.lane] += 1;
  return {
    total: items.length,
    lanes,
    connectable: items.filter((item) => item.connectable).length,
    slugs: items.map((item) => item.slug).sort(),
  };
}

export type CatalogListQuery = {
  category?: string;
  cursor?: string;
  sortBy?: "usage" | "alphabetically";
};

export async function collectCategoryPages(
  listPage: (query: CatalogListQuery) => Promise<unknown>,
  category?: string,
  sortBy?: "usage" | "alphabetically",
): Promise<ToolkitRef[]> {
  const out: ToolkitRef[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const listed = await listPage({ category, cursor, sortBy });
    out.push(...refsFromToolkitList(listed));
    cursor = catalogListCursor(listed) ?? undefined;
    pages += 1;
  } while (cursor && pages < 8);
  return out;
}

function uniqueTargets(ids: Array<string | undefined>): Array<string | undefined> {
  const out: Array<string | undefined> = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const key = id ?? "";
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

function refFromRetrieve(raw: unknown): ToolkitRef | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return mapToolkitRow(raw as Record<string, unknown>);
}

export async function collectHiringCatalog(deps: {
  listCategories: () => Promise<CatalogCategory[]>;
  listPage: (query: CatalogListQuery) => Promise<unknown>;
  getToolkit?: (slug: string) => Promise<unknown>;
}): Promise<CatalogItem[]> {
  let categories: CatalogCategory[] = [];
  try {
    categories = await deps.listCategories();
  } catch {
    categories = [];
  }
  const scanIds = hiringScanCategoryIds(categories);
  const targets = uniqueTargets([undefined, ...scanIds, ...FALLBACK_HIRING_CATEGORY_IDS]);
  const settled = await Promise.allSettled(
    targets.map((category) => collectCategoryPages(deps.listPage, category, category ? "alphabetically" : "usage")),
  );
  const refs: ToolkitRef[] = [];
  const errors: Error[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") refs.push(...result.value);
    else errors.push(result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
  }

  if (deps.getToolkit) {
    const have = new Set(refs.map((row) => row.slug));
    const missing = HIRING_PROBE_SLUGS.filter((slug) => !have.has(slug));
    const probed = await Promise.allSettled(
      missing.map(async (slug) => {
        const raw = await deps.getToolkit!(slug);
        return refFromRetrieve(raw);
      }),
    );
    for (const result of probed) {
      if (result.status === "fulfilled" && result.value) refs.push(result.value);
    }
  }

  const items = mergeHiringItems(refs);
  if (items.length === 0) {
    throw errors[0] ?? new Error("No hiring tools were returned");
  }
  return items;
}

function stringList(...candidates: unknown[]): string[] | undefined {
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    return candidate.filter((value): value is string => typeof value === "string");
  }
  return undefined;
}

function modeList(details: unknown): string[] | undefined {
  if (!Array.isArray(details)) return undefined;
  const modes = details
    .map((row) => {
      if (!row || typeof row !== "object") return "";
      const mode = (row as { mode?: unknown }).mode;
      return typeof mode === "string" ? mode : "";
    })
    .filter(Boolean);
  return modes;
}

export function mapToolkitRow(row: Record<string, unknown>): ToolkitRef | null {
  const slug = typeof row.slug === "string" ? row.slug : "";
  if (!slug) return null;
  const meta = row.meta && typeof row.meta === "object" ? (row.meta as Record<string, unknown>) : {};
  const categories = Array.isArray(meta.categories)
    ? meta.categories.filter((c): c is { name?: string; slug?: string; id?: string } => Boolean(c) && typeof c === "object")
    : [];
  const name = typeof row.name === "string" ? row.name : slug;
  const blurb =
    (typeof meta.description === "string" && meta.description) ||
    (typeof row.description === "string" && row.description) ||
    categories.map((c) => c.name).filter(Boolean).join(" · ") ||
    "";
  return {
    slug,
    label: name,
    blurb,
    category: categories[0]?.name ?? "",
    categories,
    noAuth: row.noAuth === true || row.no_auth === true,
    managedAuth: stringList(row.composioManagedAuthSchemes, row.composio_managed_auth_schemes),
    authSchemes: stringList(row.authSchemes, row.auth_schemes),
    authModes: modeList(row.authConfigDetails ?? row.auth_config_details),
  };
}

export const ROLE_NEEDLES: Record<RuntimeRole, string[]> = {
  llm: ["chat", "completion"],
  sourcing: ["search", "people"],
  ats: ["candidate"],
  outreach: ["send", "email"],
};
