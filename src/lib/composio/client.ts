import { Composio } from "@composio/core";
import { sql, sqlOne } from "@/lib/db";
import { nid } from "@/lib/ids";
import {
  collectHiringCatalog,
  toolkitLane,
  type CatalogCategory,
  type CatalogItem,
  type RuntimeRole,
} from "./catalog";
import {
  errorMessage,
  pickToolForIntent,
  ROLE_PROBE_FACTS,
  toolFromRaw,
  type ToolIntent,
  type ToolSchema,
} from "./bind";

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
    const meta = await getComposio().toolkits.get(slug);
    const managed = meta.composioManagedAuthSchemes;
    if (Array.isArray(managed) && managed.length === 0) {
      return { ok: false as const, error: "No hosted OAuth for this tool" };
    }
  } catch (err) {
    return { ok: false as const, error: errorMessage(err) };
  }

  let authConfigId: string;
  try {
    authConfigId = await ensureAuthConfig(slug);
  } catch (err) {
    return { ok: false as const, error: errorMessage(err) };
  }

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
    if (!connectedAccountId) return { ok: false as const, error: "No connection id was returned" };

    await sql(
      `INSERT INTO org_connection (id, org_id, toolkit, connected_account_id, auth_config_id, status)
       VALUES ($1,$2,$3,$4,$5,'pending')
       ON CONFLICT (org_id, toolkit) DO UPDATE SET connected_account_id=$4, auth_config_id=$5, status='pending'`,
      [nid("cnx"), orgId, slug, connectedAccountId, authConfigId],
    );
    if (!redirectUrl) return { ok: false as const, error: "No hosted auth URL was returned" };
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
    return { ok: false as const, error: errorMessage(err) };
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

export const ROLE_INTENT: Record<RuntimeRole, ToolIntent> = {
  llm: "llm_chat",
  sourcing: "people_search",
  ats: "ats_create",
  outreach: "send_email",
};

export async function firstActiveForRole(orgId: string, role: RuntimeRole, intent: ToolIntent = ROLE_INTENT[role]) {
  for (const row of await connectionsForRole(orgId, role)) {
    try {
      const tools = await listToolkitTools(row.toolkit);
      const probe = ROLE_PROBE_FACTS[intent] ?? {};
      const picked = pickToolForIntent(tools, intent, probe);
      if (picked.ok) return row;
    } catch {
      continue;
    }
  }
  return undefined;
}

export async function laneCanRun(
  orgId: string,
  role: RuntimeRole,
): Promise<{ ok: boolean; toolkit?: string; error: string }> {
  const intents: ToolIntent[] = role === "ats" ? ["ats_list", "ats_create"] : [ROLE_INTENT[role]];
  const connections = await connectionsForRole(orgId, role);
  if (connections.length === 0) {
    return { ok: false, error: `No ${role} account is signed in` };
  }
  const errors: string[] = [];
  for (const row of connections) {
    try {
      const tools = await listToolkitTools(row.toolkit);
      for (const intent of intents) {
        const picked = pickToolForIntent(tools, intent, ROLE_PROBE_FACTS[intent] ?? {});
        if (picked.ok) return { ok: true, toolkit: row.toolkit, error: "" };
        errors.push(`${row.toolkit}: ${picked.error}`);
      }
    } catch (err) {
      errors.push(`${row.toolkit}: ${errorMessage(err)}`);
    }
  }
  return {
    ok: false,
    toolkit: connections[0]?.toolkit,
    error: errors[0] ?? `Signed in to ${connections[0]?.toolkit ?? role}, but no runnable ${role} tool`,
  };
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

const toolCache = new Map<string, ToolSchema[]>();

export async function listToolkitTools(toolkit: string): Promise<ToolSchema[]> {
  const hit = toolCache.get(toolkit);
  if (hit) return hit;
  if (!composioConfigured()) return [];
  const raw = await getComposio().tools.getRawComposioTools({ toolkits: [toolkit], limit: 100 });
  const tools = raw.map(toolFromRaw).filter((row): row is ToolSchema => Boolean(row));
  toolCache.set(toolkit, tools);
  return tools;
}

export async function executeIntent(input: {
  orgId: string;
  toolkit: string;
  connectedAccountId: string;
  intent: ToolIntent;
  facts: Record<string, unknown>;
}) {
  let tools: ToolSchema[];
  try {
    tools = await listToolkitTools(input.toolkit);
  } catch (err) {
    return { successful: false as const, error: errorMessage(err), data: null };
  }
  const picked = pickToolForIntent(tools, input.intent, input.facts);
  if (!picked.ok) return { successful: false as const, error: picked.error, data: null };
  try {
    const result = await executeTool({
      orgId: input.orgId,
      toolkit: input.toolkit,
      connectedAccountId: input.connectedAccountId,
      slug: picked.tool.slug,
      arguments: picked.args,
    });
    return result;
  } catch (err) {
    return {
      successful: false as const,
      error: errorMessage(err),
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

async function listToolkitPage(query: { category?: string; cursor?: string }): Promise<unknown> {
  return getComposio().toolkits.get({
    limit: 100,
    sortBy: "alphabetically",
    ...(query.category ? { category: query.category } : {}),
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });
}

export async function listHiringCatalog(): Promise<{ items: CatalogItem[]; nextCursor: null }> {
  if (!composioConfigured()) throw new Error("COMPOSIO_API_KEY is not set");
  try {
    const items = await collectHiringCatalog({
      listCategories: listCatalogCategories,
      listPage: listToolkitPage,
    });
    return { items, nextCursor: null };
  } catch (err) {
    throw new Error(errorMessage(err));
  }
}
