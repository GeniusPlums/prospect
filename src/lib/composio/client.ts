import { Composio } from "@composio/core";
import { sql, sqlOne } from "@/lib/db";
import { nid } from "@/lib/ids";
import { RECOMMENDED } from "./catalog";

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
  if (!RECOMMENDED.some((item) => item.slug === toolkit)) {
    return { ok: false as const, error: "Unknown toolkit" };
  }
  if (!composioConfigured()) {
    return { ok: false as const, error: "COMPOSIO_API_KEY is not set" };
  }
  const authConfigId = await ensureAuthConfig(toolkit);
  const existing = await sqlOne<{ connected_account_id: string; status: string }>(
    `SELECT connected_account_id, status FROM org_connection WHERE org_id=$1 AND toolkit=$2`,
    [orgId, toolkit],
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
      [nid("cnx"), orgId, toolkit, connectedAccountId, authConfigId],
    );
    if (!redirectUrl) return { ok: false as const, error: "Composio did not return a hosted auth URL" };
    return { ok: true as const, alreadyConnected: false as const, redirectUrl, connectedAccountId };
  } catch (err) {
    const listed = await getComposio().connectedAccounts.list({
      userIds: [orgId],
      toolkitSlugs: [toolkit],
      statuses: ["ACTIVE"],
    });
    const active = listed.items[0];
    if (active) {
      await sql(
        `INSERT INTO org_connection (id, org_id, toolkit, connected_account_id, auth_config_id, status)
         VALUES ($1,$2,$3,$4,$5,'active')
         ON CONFLICT (org_id, toolkit) DO UPDATE SET connected_account_id=$4, auth_config_id=$5, status='active'`,
        [nid("cnx"), orgId, toolkit, active.id, authConfigId],
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
  const listed = await getComposio().connectedAccounts.list({ userIds: [orgId], limit: 50 });
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

export async function firstActive(orgId: string, toolkits: readonly string[]) {
  for (const toolkit of toolkits) {
    const row = await getOrgConnection(orgId, toolkit);
    if (row) return row;
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
  const slugs = await listToolkitSlugs(toolkit);
  const ranked = slugs
    .map((slug) => {
      const lower = slug.toLowerCase();
      const score = needles.reduce((sum, needle) => sum + (lower.includes(needle.toLowerCase()) ? 1 : 0), 0);
      return { slug, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.slug ?? slugs[0];
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
