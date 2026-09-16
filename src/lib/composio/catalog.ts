export type CatalogItem = {
  slug: string;
  label: string;
  blurb: string;
  category: string;
};

export type CatalogCategory = { id: string; name: string };

export type RuntimeRole = "llm" | "sourcing" | "ats" | "outreach";

export type ToolkitLane = RuntimeRole | "other";

/** Map Composio category names/slugs to a runtime job. Not a toolkit allowlist. */
export function roleFromCategoryText(text: string): RuntimeRole | null {
  const t = text.toLowerCase();
  if (/ai[- ]models?|\bllm\b|language models?|generative ai|openai/.test(t)) return "llm";
  if (/talent intelligence|people data|people search|contact data|\bsourcing\b|\bsource\b/.test(t)) return "sourcing";
  if (/\bats\b|applicant|hris|human resources?|\bhr\b|recruiting/.test(t)) return "ats";
  if (/\bemail\b|\bmail\b|inbox|messaging|communication|outreach/.test(t)) return "outreach";
  return null;
}

export function roleFromCategories(categories: { name?: string; slug?: string }[]): RuntimeRole | null {
  for (const category of categories) {
    const hit = roleFromCategoryText(`${category.slug ?? ""} ${category.name ?? ""}`);
    if (hit) return hit;
  }
  return null;
}

export const ROLE_NEEDLES: Record<RuntimeRole, string[]> = {
  llm: ["chat", "completion"],
  sourcing: ["search", "people"],
  ats: ["candidate"],
  outreach: ["send", "email"],
};
