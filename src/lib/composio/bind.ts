export type ToolIntent =
  | "people_search"
  | "person_get"
  | "llm_chat"
  | "send_email"
  | "ats_create"
  | "ats_list"
  | "email_find";

export type ToolSchema = {
  slug: string;
  name: string;
  description: string;
  properties: Record<string, { type?: string; description?: string; default?: unknown }>;
  required: string[];
};

export type BindOk = { ok: true; tool: ToolSchema; args: Record<string, unknown> };
export type BindFail = { ok: false; error: string };

const ALIASES: Record<string, string[]> = {
  q: ["q", "query", "search", "keywords", "keyword", "text"],
  query: ["query", "q", "search", "keywords", "keyword", "text"],
  search: ["search", "query", "q", "keywords"],
  keywords: ["keywords", "keyword", "query", "q"],
  location: ["location", "city", "geo", "country"],
  model: ["model"],
  messages: ["messages"],
  temperature: ["temperature"],
  max_tokens: ["max_tokens", "max_completion_tokens", "maxTokens"],
  max_completion_tokens: ["max_completion_tokens", "max_tokens", "maxTokens"],
  to: ["to", "recipient", "recipient_email", "email"],
  recipient: ["recipient", "to", "recipient_email", "email"],
  recipient_email: ["recipient_email", "to", "email"],
  subject: ["subject", "title"],
  body: ["body", "body_text", "html", "text", "content", "message"],
  body_text: ["body_text", "body", "text", "content"],
  name: ["name", "full_name", "candidate_name"],
  full_name: ["full_name", "name"],
  first_name: ["first_name", "firstName"],
  last_name: ["last_name", "lastName"],
  domain: ["domain", "company_domain", "company"],
  company: ["company", "domain"],
  limit: ["limit", "per_page", "page_size", "count"],
  per_page: ["per_page", "limit", "page_size"],
  ids: ["ids"],
  id: ["id"],
};

const INTENT_SPEC: Record<ToolIntent, { any: string[]; nice: string[]; reject: string[] }> = {
  people_search: { any: ["search"], nice: ["people", "person", "talent", "employee", "candidate"], reject: ["send_email", "send email"] },
  person_get: { any: ["get", "retrieve"], nice: ["person", "profile", "employee", "candidate"], reject: [] },
  llm_chat: { any: ["chat", "completion"], nice: ["message"], reject: ["embed"] },
  send_email: { any: ["send"], nice: ["email", "mail", "message"], reject: ["draft"] },
  ats_create: { any: ["create"], nice: ["candidate", "applicant"], reject: [] },
  ats_list: { any: ["list"], nice: ["candidate", "applicant"], reject: [] },
  email_find: { any: ["find", "enrich", "reveal", "lookup"], nice: ["email"], reject: ["send"] },
};

function compact(value: string) {
  return value.toLowerCase().replace(/[_-\s]/g, "");
}

export function toolFromRaw(raw: {
  slug?: string;
  name?: string;
  description?: string;
  inputParameters?: {
    properties?: Record<string, { type?: unknown; description?: string; default?: unknown }>;
    required?: string[];
  };
}): ToolSchema | null {
  if (!raw.slug) return null;
  const properties: ToolSchema["properties"] = {};
  for (const [key, spec] of Object.entries(raw.inputParameters?.properties ?? {})) {
    const type = Array.isArray(spec.type) ? spec.type[0] : spec.type;
    properties[key] = {
      type: typeof type === "string" ? type : undefined,
      description: spec.description,
      default: spec.default,
    };
  }
  return {
    slug: raw.slug,
    name: raw.name || raw.slug,
    description: raw.description ?? "",
    properties,
    required: raw.inputParameters?.required ?? [],
  };
}

export function valueForProperty(prop: string, facts: Record<string, unknown>): unknown {
  if (facts[prop] !== undefined && facts[prop] !== "") return facts[prop];
  const aliases = ALIASES[prop] ?? ALIASES[prop.toLowerCase()];
  if (aliases) {
    for (const key of aliases) {
      if (facts[key] !== undefined && facts[key] !== "") return facts[key];
    }
  }
  const want = compact(prop);
  for (const [key, value] of Object.entries(facts)) {
    if (value === undefined || value === "") continue;
    if (compact(key) === want) return value;
  }
  return undefined;
}

export function bindArgs(
  schema: ToolSchema,
  facts: Record<string, unknown>,
): { ok: true; args: Record<string, unknown> } | { ok: false; error: string } {
  const args: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(schema.properties)) {
    const value = valueForProperty(key, facts);
    if (value !== undefined) args[key] = value;
    else if (spec.default !== undefined) args[key] = spec.default;
  }
  const missing: string[] = [];
  for (const key of schema.required) {
    if (args[key] !== undefined && args[key] !== "") continue;
    missing.push(key);
  }
  if (missing.length) {
    return { ok: false, error: `Cannot call ${schema.slug}: missing required ${missing.join(", ")}` };
  }
  return { ok: true, args };
}

function haystack(tool: ToolSchema) {
  return `${tool.slug} ${tool.name} ${tool.description}`.toLowerCase().replace(/[_-]+/g, " ");
}

function hasProp(tool: ToolSchema, names: string[]) {
  const keys = Object.keys(tool.properties).map(compact);
  return names.some((name) => keys.includes(compact(name)));
}

export function scoreToolForIntent(tool: ToolSchema, intent: ToolIntent): number {
  const text = haystack(tool);
  const spec = INTENT_SPEC[intent];
  if (spec.reject.some((needle) => text.includes(needle))) return 0;
  let score = 0;
  for (const needle of spec.any) {
    if (text.includes(needle)) score += 3;
  }
  if (score === 0) return 0;
  for (const needle of spec.nice) {
    if (text.includes(needle)) score += 1;
  }
  if (intent === "people_search" && hasProp(tool, ["q", "query", "search", "keywords"])) score += 4;
  if (intent === "llm_chat" && hasProp(tool, ["messages", "prompt"])) score += 4;
  if (intent === "send_email" && hasProp(tool, ["to", "recipient", "recipient_email"])) score += 4;
  if (intent === "ats_create" && hasProp(tool, ["name", "first_name", "candidate_name"])) score += 2;
  return score;
}

export function pickToolForIntent(tools: ToolSchema[], intent: ToolIntent, facts: Record<string, unknown>): BindOk | BindFail {
  const ranked = tools
    .map((tool) => ({ tool, score: scoreToolForIntent(tool, intent) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  const errors: string[] = [];
  for (const row of ranked) {
    const bound = bindArgs(row.tool, facts);
    if (bound.ok) return { ok: true, tool: row.tool, args: bound.args };
    errors.push(bound.error);
  }
  const label = intent.replace(/_/g, " ");
  if (ranked.length === 0) return { ok: false, error: `No ${label} tool on this connection` };
  return { ok: false, error: errors[0] ?? `Cannot map ${label} arguments` };
}

export const ROLE_PROBE_FACTS: Record<string, Record<string, unknown>> = {
  llm_chat: {
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "ping" }],
    temperature: 0,
    max_tokens: 16,
  },
  people_search: { q: "engineer", query: "engineer", location: "India", limit: 10 },
  person_get: { id: "probe", ids: ["probe"] },
  send_email: { to: "noreply@invalid.local", subject: "probe", body: "probe" },
  ats_create: { name: "Probe Candidate", first_name: "Probe", last_name: "Candidate" },
  ats_list: { limit: 10, per_page: 10 },
  email_find: { name: "Probe Candidate", full_name: "Probe Candidate", domain: "example.com" },
};

export function errorMessage(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = err;
  for (let i = 0; i < 4 && current; i += 1) {
    if (current instanceof Error) {
      if (current.message) parts.push(current.message);
      current = current.cause;
      continue;
    }
    break;
  }
  return [...new Set(parts)].join(": ") || "Unknown error";
}
