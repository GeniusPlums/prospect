import { errorMessage } from "./bind";

export const TOOLKIT_SLUG = /^[a-z0-9_-]{2,80}$/;

export type ConnectToolkitMeta = {
  composioManagedAuthSchemes?: string[];
  authConfigDetails?: { mode?: string }[];
};

export type ConnectHost = {
  getToolkit: (slug: string) => Promise<ConnectToolkitMeta>;
  listAuthConfigs: (toolkit: string) => Promise<{ id: string }[]>;
  createManagedAuthConfig: (toolkit: string) => Promise<string>;
  existingConnection: (
    orgId: string,
    toolkit: string,
  ) => Promise<{ connected_account_id: string; status: string } | undefined>;
  link: (
    orgId: string,
    authConfigId: string,
    callbackUrl: string,
  ) => Promise<{ id?: string; redirectUrl?: string | null }>;
  savePending: (orgId: string, toolkit: string, connectedAccountId: string, authConfigId: string) => Promise<void>;
  saveActive: (orgId: string, toolkit: string, connectedAccountId: string, authConfigId: string) => Promise<void>;
  listActiveAccount: (orgId: string, toolkit: string) => Promise<{ id: string } | undefined>;
};

export type ConnectOk =
  | { ok: true; alreadyConnected: true; connectedAccountId: string }
  | { ok: true; alreadyConnected: false; redirectUrl: string; connectedAccountId: string };
export type ConnectFail = { ok: false; error: string };
export type ConnectResult = ConnectOk | ConnectFail;

/**
 * Start hosted auth (OAuth or API key) via connectedAccounts.link.
 * Empty composioManagedAuthSchemes is not a refusal — create managed auth and link.
 */
export async function startConnectFlow(
  orgId: string,
  toolkit: string,
  callbackUrl: string,
  host: ConnectHost,
): Promise<ConnectResult> {
  const slug = toolkit.trim().toLowerCase();
  if (!TOOLKIT_SLUG.test(slug)) {
    return { ok: false, error: "Unknown toolkit" };
  }

  try {
    await host.getToolkit(slug);
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  let authConfigId: string;
  try {
    const listed = await host.listAuthConfigs(slug);
    authConfigId = listed[0]?.id ?? (await host.createManagedAuthConfig(slug));
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  const existing = await host.existingConnection(orgId, slug);
  if (existing?.status === "active") {
    return { ok: true, alreadyConnected: true, connectedAccountId: existing.connected_account_id };
  }

  try {
    const link = await host.link(orgId, authConfigId, callbackUrl);
    const connectedAccountId = link.id;
    if (!connectedAccountId) return { ok: false, error: "No connection id was returned" };
    await host.savePending(orgId, slug, connectedAccountId, authConfigId);
    if (!link.redirectUrl) return { ok: false, error: "No hosted auth URL was returned" };
    return { ok: true, alreadyConnected: false, redirectUrl: link.redirectUrl, connectedAccountId };
  } catch (err) {
    const active = await host.listActiveAccount(orgId, slug);
    if (active) {
      await host.saveActive(orgId, slug, active.id, authConfigId);
      return { ok: true, alreadyConnected: true, connectedAccountId: active.id };
    }
    return { ok: false, error: errorMessage(err) };
  }
}
