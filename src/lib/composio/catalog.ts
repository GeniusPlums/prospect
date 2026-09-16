export type CatalogItem = {
  slug: string;
  label: string;
  blurb: string;
  category: string;
  lane: RuntimeRole;
};

export type CatalogCategory = { id: string; name: string };

export type RuntimeRole = "llm" | "sourcing" | "ats" | "outreach";

export type ToolkitRef = {
  slug: string;
  label?: string;
  blurb?: string;
  category?: string;
  categories?: { name?: string; slug?: string; id?: string }[];
};

export const LANE_ORDER: RuntimeRole[] = ["llm", "sourcing", "ats", "outreach"];

export const LANE_LABEL: Record<RuntimeRole, string> = {
  llm: "LLM / AI / brain",
  sourcing: "Sourcing / people",
  ats: "ATS / HRIS / recruiting",
  outreach: "Outreach / email / messaging",
};

/** Map Composio category names/slugs to a runtime job. Not a toolkit allowlist. */
export function roleFromCategoryText(text: string): RuntimeRole | null {
  const t = text.toLowerCase().replace(/[_-]/g, " ");
  if (isNoiseCategoryText(t)) return null;
  if (/ai models?|\bllm\b|language models?|generative ai|\bopenai\b|machine learning models?/.test(t)) return "llm";
  if (/talent intelligence|people data|people search|contact data|\bsourcing\b|recruiting data/.test(t)) return "sourcing";
  if (/\bats\b|applicant|hris|human resources?|\bhr\b|recruiting/.test(t)) return "ats";
  if (/\bemail\b|\bmail\b|inbox|messaging|communication|outreach/.test(t)) return "outreach";
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
  /\b(devops|kubernetes|\bk8s\b|docker|terraform|ansible|jenkins|circleci|github|gitlab|bitbucket|\baws\b|amazon web|google cloud|\bgcp\b|azure devops|postgres|postgresql|mysql|mongodb|\bredis\b|snowflake|bigquery|dynamodb|cassandra|elasticsearch|\bkafka\b|prometheus|grafana|datadog|sentry|pagerduty|\bjira\b|linear app|\basana\b|trello|confluence|\bfigma\b|stripe|shopify|\bvercel\b|netlify|heroku|cloudflare|\bnginx\b|bitbucket)\b/;

function laneFromKeywords(text: string): RuntimeRole | null {
  if (
    /\b(openai|anthropic|claude|groq|gemini|mistral|together ai|fireworks|perplexity|hugging ?face|cohere|vertex ai|bedrock|deepseek|ollama|openrouter|cerebras|\bgrok\b|\bxai\b|google ai|ai studio|language model|\bllm\b|generative ai|ai models?)\b/.test(
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
    /\b(apollo|linkedin|people data labs|\bpdl\b|hunter|coresignal|zoominfo|lusha|contactout|rocketreach|clearbit|fullenrich|dropcontact|proxycurl|snov|cognism|hireez|seekout|people search|talent intel|contact data|email finder|people data)\b/.test(
      text,
    )
  ) {
    return "sourcing";
  }
  if (
    /\b(gmail|outlook|office 365|microsoft 365|microsoft outlook|\bslack\b|microsoft teams|sendgrid|mailgun|postmark|twilio|whatsapp|resend|\binbox\b)\b/.test(
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

export function toHiringCatalogItem(ref: ToolkitRef): CatalogItem | null {
  const lane = toolkitLane(ref);
  if (!lane) return null;
  return {
    slug: ref.slug,
    label: ref.label || ref.slug,
    blurb: ref.blurb ?? "",
    category: LANE_LABEL[lane],
    lane,
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
  if (!page || typeof page !== "object") return null;
  const rec = page as Record<string, unknown>;
  const value = rec.nextCursor ?? rec.next_cursor;
  return typeof value === "string" && value.length > 0 ? value : null;
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
  };
}

export const ROLE_NEEDLES: Record<RuntimeRole, string[]> = {
  llm: ["chat", "completion"],
  sourcing: ["search", "people"],
  ats: ["candidate"],
  outreach: ["send", "email"],
};
