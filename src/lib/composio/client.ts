import { Composio } from "@composio/core";
import { sql, sqlOne } from "@/lib/db";
import { nid } from "@/lib/ids";
import {
  catalogCursor,
  extractToolkitRows,
  mapToolkitRow,
  toHiringCatalogItem,
  toolkitLane,
  ROLE_NEEDLES,
  type CatalogCategory,
  type CatalogItem,
  type RuntimeRole,
} from "./catalog";

let cached: Composio | undefined;

export function composioConfigured(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY);
}

export function getComposio(): Composio {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) throw new Error("COMPOSIO_API_KEY is not set");
  if (!cached) cached = new Composio({ apiKey, allowTracking: false });
  return cached;
}

export async function ensureAuthConfig(toolkit: string): Promise<string> {
  const existing = await sqlOne<{ auth_config_id: string }>(
    `SELECT auth_config_id FROM composio_auth_config WHERE toolkit=$1`,
    [toolkit],
  );
  if (existing?.auth_config_id) return existing.auth_config_id;

  const listed = await getComposio().authConfigs.list({ toolkit, isComposioManaged: true, limit: 5 });
  const found = listed.items[0]?.id;
  const id =
    found ??
    (
      await getComposio().authConfigs.create(toolkit, {
        type: "use_composio_managed_auth",
        name: `Prospect ${toolkit}`,
      })
    ).id;

  await sql(
    `INSERT INTO composio_auth_config (toolkit, auth_config_id) VALUES ($1,$2)
     ON CONFLICT (toolkit) DO UPDATE SET auth_config_id=$2`,
    [toolkit, id],
  );
  return id;
}

export async function startConnect(orgId: string, toolkit: string, callbackUrl: string) {
  if (!composioConfigured()) {
    return { ok: false as const, error: "COMPOSIO_API_KEY is not set" };
  }
  const slug = toolkit.trim().toLowerCase();
  if (!/^[a-z0-9_]{2,80}$/.test(slug)) {
    return { ok: false as const, error: "Unknown toolkit" };
  }
  try {
    await getComposio().toolkits.get(slug);
  } catch {
    return { ok: false as const, error: "Composio does not list that toolkit" };
  }
  const authConfigId = await ensureAuthConfig(slug);
  const existing = await sqlOne<{ connected_account_id: string; status: string }>(
    `SELECT connected_account_id, status FROM org_connection WHERE org_id=$1 AND toolkit=$2`,
    [orgId, slug],
  );
  if (existing?.status === "active") {
    return { ok: true as const, alreadyConnected: true as const, connectedAccountId: existing.connected_account_id };
  }

  try {
    const link = await getComposio().connectedAccounts.link(orgId, authConfigId, {
      callbackUrl,
      allowMultiple: false,
    });
    const connectedAccountId = link.id;
    const redirectUrl = link.redirectUrl;
    if (!connectedAccountId) return { ok: false as const, error: "Composio did not return a connection id" };

    await sql(
      `INSERT INTO org_connection (id, org_id, toolkit, connected_account_id, auth_config_id, status)
       VALUES ($1,$2,$3,$4,$5,'pending')
       ON CONFLICT (org_id, toolkit) DO UPDATE SET connected_account_id=$4, auth_config_id=$5, status='pending'`,
      [nid("cnx"), orgId, slug, connectedAccountId, authConfigId],
    );
    if (!redirectUrl) return { ok: false as const, error: "Composio did not return a hosted auth URL" };
    return { ok: true as const, alreadyConnected: false as const, redirectUrl, connectedAccountId };
  } catch (err) {
    const listed = await getComposio().connectedAccounts.list({
      userIds: [orgId],
      toolkitSlugs: [slug],
      statuses: ["ACTIVE"],
    });
    const active = listed.items[0];
    if (active) {
      await sql(
        `INSERT INTO org_connection (id, org_id, toolkit, connected_account_id, auth_config_id, status)
         VALUES ($1,$2,$3,$4,$5,'active')
         ON CONFLICT (org_id, toolkit) DO UPDATE SET connected_account_id=$4, auth_config_id=$5, status='active'`,
        [nid("cnx"), orgId, slug, active.id, authConfigId],
      );
      return { ok: true as const, alreadyConnected: true as const, connectedAccountId: active.id };
    }
    return { ok: false as const, error: err instanceof Error ? err.message : "Could not start Composio connect" };
  }
}

export async function syncOrgConnections(orgId: string) {
  if (!composioConfigured()) {
    return sql<{ toolkit: string; status: string; connected_account_id: string }>(
      `SELECT toolkit, status, connected_account_id FROM org_connection WHERE org_id=$1`,
      [orgId],
    );
  }
  const listed = await getComposio().connectedAccounts.list({ userIds: [orgId], limit: 200 });
  for (const account of listed.items) {
    const toolkit = account.toolkit?.slug;
    if (!toolkit) continue;
    const status = account.status === "ACTIVE" ? "active" : account.status === "FAILED" ? "failed" : "pending";
    await sql(
      `INSERT INTO org_connection (id, org_id, toolkit, connected_account_id, auth_config_id, status)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (org_id, toolkit) DO UPDATE SET connected_account_id=$4, status=$6`,
      [nid("cnx"), orgId, toolkit, account.id, account.authConfig.id, status],
    );
  }
  return sql<{ toolkit: string; status: string; connected_account_id: string }>(
    `SELECT toolkit, status, connected_account_id FROM org_connection WHERE org_id=$1 ORDER BY toolkit`,
    [orgId],
  );
}

export async function getOrgConnection(orgId: string, toolkit: string) {
  return sqlOne<{ toolkit: string; status: string; connected_account_id: string }>(
    `SELECT toolkit, status, connected_account_id FROM org_connection WHERE org_id=$1 AND toolkit=$2 AND status='active'`,
    [orgId, toolkit],
  );
}

export async function listActiveConnections(orgId: string) {
  return sql<{ toolkit: string; connected_account_id: string }>(
    `SELECT toolkit, connected_account_id FROM org_connection WHERE org_id=$1 AND status='active'`,
    [orgId],
  );
}

const metaCache = new Map<string, { slug: string; name: string; categories: { slug: string; name: string }[] }>();

export async function toolkitCategories(slug: string): Promise<{ slug: string; name: string }[]> {
  const hit = metaCache.get(slug);
  if (hit) return hit.categories;
  if (!composioConfigured()) return [];
  try {
    const toolkit = await getComposio().toolkits.get(slug);
    const categories = toolkit.meta?.categories ?? [];
    metaCache.set(slug, { slug: toolkit.slug, name: toolkit.name, categories });
    return categories;
  } catch {
    return [];
  }
}

export async function connectionsForRole(orgId: string, role: RuntimeRole) {
  const active = await listActiveConnections(orgId);
  const matched: typeof active = [];
  for (const row of active) {
    const hit = metaCache.get(row.toolkit);
    const categories = hit?.categories ?? (await toolkitCategories(row.toolkit));
    const lane = toolkitLane({
      slug: row.toolkit,
      label: hit?.name ?? row.toolkit,
      categories,
    });
    if (lane === role) matched.push(row);
  }
  return matched;
}

export async function hasLaneConnection(orgId: string, role: RuntimeRole) {
  return (await connectionsForRole(orgId, role)).length > 0;
}

export async function firstActiveForRole(orgId: string, role: RuntimeRole, needles = ROLE_NEEDLES[role]) {
  for (const row of await connectionsForRole(orgId, role)) {
    const slug = await pickToolSlug(row.toolkit, needles);
    if (slug) return row;
  }
  return undefined;
}

export async function executeTool(input: {
  orgId: string;
  toolkit: string;
  connectedAccountId: string;
  slug: string;
  arguments: Record<string, unknown>;
}) {
  const result = await getComposio().tools.execute(input.slug, {
    userId: input.orgId,
    connectedAccountId: input.connectedAccountId,
    arguments: input.arguments,
    dangerouslySkipVersionCheck: true,
  });
  return result;
}

const slugCache = new Map<string, string[]>();

export async function listToolkitSlugs(toolkit: string): Promise<string[]> {
  const hit = slugCache.get(toolkit);
  if (hit) return hit;
  const tools = await getComposio().tools.getRawComposioTools({ toolkits: [toolkit], limit: 100 });
  const slugs = tools.map((tool) => tool.slug).filter(Boolean);
  slugCache.set(toolkit, slugs);
  return slugs;
}

export async function pickToolSlug(toolkit: string, needles: string[]): Promise<string | undefined> {
  if (!composioConfigured()) return undefined;
  try {
    const slugs = await listToolkitSlugs(toolkit);
    const ranked = slugs
      .map((slug) => {
        const lower = slug.toLowerCase();
        const score = needles.reduce((sum, needle) => sum + (lower.includes(needle.toLowerCase()) ? 1 : 0), 0);
        return { slug, score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score);
    return ranked[0]?.slug;
  } catch {
    return undefined;
  }
}

export async function executeIntent(input: {
  orgId: string;
  toolkit: string;
  connectedAccountId: string;
  needles: string[];
  arguments: Record<string, unknown>;
}) {
  const slug = await pickToolSlug(input.toolkit, input.needles);
  if (!slug) return { successful: false as const, error: `No ${input.toolkit} tools available`, data: null };
  try {
    const result = await executeTool({ ...input, slug, arguments: input.arguments });
    return result;
  } catch (err) {
    return {
      successful: false as const,
      error: err instanceof Error ? err.message : "Tool execute failed",
      data: null,
    };
  }
}

export async function listCatalogCategories(): Promise<CatalogCategory[]> {
  if (!composioConfigured()) throw new Error("COMPOSIO_API_KEY is not set");
  const listed = await getComposio().toolkits.listCategories();
  return (listed.items ?? []).map((item) => {
    const rec = item as { id?: string; slug?: string; name: string };
    return { id: rec.id ?? rec.slug ?? "", name: rec.name };
  }).filter((item) => item.id);
}

type ToolkitLister = {
  get: (query: unknown) => Promise<unknown>;
  list?: (query: unknown) => Promise<unknown>;
};

async function fetchToolkitList(query: Record<string, unknown>): Promise<unknown> {
  const toolkits = getComposio().toolkits as unknown as ToolkitLister;
  if (typeof toolkits.list === "function") return toolkits.list(query);
  return toolkits.get(query);
}

async function listRawCatalogPage(input: { category?: string; cursor?: string }): Promise<{
  rows: ReturnType<typeof mapToolkitRow>[];
  nextCursor: string | null;
}> {
  const query: Record<string, unknown> = { limit: 100, sortBy: "alphabetically" };
  if (input.category) query.category = input.category;
  if (input.cursor) query.cursor = input.cursor;
  const listed = await fetchToolkitList(query);
  const rows = extractToolkitRows(listed).map(mapToolkitRow);
  const nextFromPage = catalogCursor(listed);
  const filled = rows.filter(Boolean);
  const nextFromFullPage =
    !nextFromPage && filled.length >= 100 ? filled[filled.length - 1]?.slug ?? null : null;
  return { rows, nextCursor: nextFromPage ?? nextFromFullPage };
}

async function collectPages(category?: string): Promise<ReturnType<typeof mapToolkitRow>[]> {
  const out: ReturnType<typeof mapToolkitRow>[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const page = await listRawCatalogPage({ category, cursor });
    out.push(...page.rows);
    cursor = page.nextCursor ?? undefined;
    pages += 1;
  } while (cursor && pages < 16);
  return out;
}

export async function listHiringCatalog(): Promise<{ items: CatalogItem[]; nextCursor: null }> {
  if (!composioConfigured()) throw new Error("COMPOSIO_API_KEY is not set");
  const seen = new Map<string, CatalogItem>();
  const refs = await collectPages();
  for (const ref of refs) {
    if (!ref) continue;
    const item = toHiringCatalogItem(ref);
    if (item) seen.set(item.slug, item);
  }

  if (seen.size === 0) {
    throw new Error("Composio returned no hiring toolkits");
  }

  const items = [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  return { items, nextCursor: null };
}
