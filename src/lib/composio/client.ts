import { Composio } from "@composio/core";
import { sql, sqlOne } from "@/lib/db";
import { nid } from "@/lib/ids";
import { roleFromCategories, ROLE_NEEDLES, type CatalogCategory, type CatalogItem, type RuntimeRole } from "./catalog";

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
  const rest: typeof active = [];
  for (const row of active) {
    const categories = await toolkitCategories(row.toolkit);
    if (roleFromCategories(categories) === role) matched.push(row);
    else rest.push(row);
  }
  return [...matched, ...rest];
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
  if (!composioConfigured()) return [];
  const listed = await getComposio().toolkits.listCategories();
  return listed.items.map((item) => ({ id: item.id, name: item.name }));
}

function catalogCursor(page: unknown): string | null {
  if (!page || typeof page !== "object") return null;
  const rec = page as Record<string, unknown>;
  const value = rec.nextCursor ?? rec.next_cursor;
  return typeof value === "string" && value.length > 0 ? value : null;
}

type ToolkitRow = {
  slug?: string;
  name?: string;
  meta?: { description?: string; categories?: { name: string; slug: string }[] };
};

function mapToolkitRow(item: ToolkitRow, fallbackCategory: string): CatalogItem | null {
  if (!item.slug) return null;
  return {
    slug: item.slug,
    label: item.name || item.slug,
    blurb: item.meta?.description ?? item.meta?.categories?.map((c) => c.name).join(" · ") ?? "",
    category: item.meta?.categories?.[0]?.name ?? fallbackCategory,
  };
}

export async function listCatalogPage(input: { category?: string; cursor?: string }): Promise<{
  items: CatalogItem[];
  nextCursor: string | null;
}> {
  if (!composioConfigured()) return { items: [], nextCursor: null };
  const query = {
    category: input.category,
    cursor: input.cursor,
    limit: 40,
    sortBy: "alphabetically" as const,
  };
  const listToolkits = getComposio().toolkits.get as (q: typeof query) => Promise<unknown>;
  const listed = await listToolkits(query);
  const rows: ToolkitRow[] = Array.isArray(listed)
    ? listed
    : listed && typeof listed === "object" && Array.isArray((listed as { items?: unknown }).items)
      ? ((listed as { items: ToolkitRow[] }).items)
      : [];
  const items = rows.map((row) => mapToolkitRow(row, input.category ?? "")).filter((row): row is CatalogItem => Boolean(row));
  const nextFromPage = catalogCursor(listed);
  const nextFromFullPage = !nextFromPage && Array.isArray(listed) && rows.length >= 40 ? rows[rows.length - 1]?.slug ?? null : null;
  return { items, nextCursor: nextFromPage ?? nextFromFullPage };
}
