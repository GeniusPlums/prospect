import { localSource } from "./profile-source/active";
import type { PeopleSource } from "./profile-source/types";
import { executeIntent, firstActiveForRole, listActiveConnections } from "@/lib/composio/client";
import { findEmail, parseAtsPeople } from "@/lib/composio/parse";
import { composioPeopleSource } from "@/lib/composio/people";
import { DEV_ORG } from "@/lib/ids";

const emptySource: PeopleSource = {
  name: "none",
  async search() {
    return [];
  },
  async collect() {
    return [];
  },
};

export function peopleSource(): PeopleSource {
  return localSource;
}

export async function peopleSourceForOrg(orgId: string): Promise<PeopleSource> {
  const connected = await composioPeopleSource(orgId);
  if (connected) return connected;
  if (orgId === DEV_ORG) return localSource;
  return emptySource;
}

export type ArtifactHit = { url: string; title: string; markdown: string };

export async function discoverArtifacts(query: string): Promise<ArtifactHit[]> {
  if (!process.env.FIRECRAWL_API_KEY) return [];
  void query;
  return [];
}

export async function githubSignal(handle: string): Promise<string | null> {
  if (!process.env.GITHUB_TOKEN && !handle) return null;
  return handle ? `https://github.com/${handle}` : null;
}

export type ContactHit = { email: string; provider: string; costUsd: number };

export async function contactWaterfall(input: {
  name: string;
  orgId: string;
  domain?: string;
}): Promise<{ attempts: { provider: string; outcome: string; costUsd: number }[]; hit: ContactHit | null }> {
  const attempts: { provider: string; outcome: string; costUsd: number }[] = [];
  const connections = await listActiveConnections(input.orgId);
  if (connections.length === 0) return { attempts, hit: null };

  for (const connection of connections) {
      const result = await executeIntent({
        orgId: input.orgId,
        toolkit: connection.toolkit,
        connectedAccountId: connection.connected_account_id,
        intent: "email_find",
        facts: {
          full_name: input.name,
          name: input.name,
          domain: input.domain ?? "",
          company: input.domain ?? "",
        },
      });
      if (result.successful === false && result.error?.startsWith("No ")) {
      attempts.push({ provider: connection.toolkit, outcome: "skipped_no_email_tool", costUsd: 0 });
      continue;
    }
    const email = findEmail(result.data);
    if (email) {
      attempts.push({ provider: connection.toolkit, outcome: "hit", costUsd: 0.1 });
      return { attempts, hit: { email, provider: connection.toolkit, costUsd: 0.1 } };
    }
    attempts.push({
      provider: connection.toolkit,
      outcome: result.successful === false ? "error" : "miss",
      costUsd: 0.1,
    });
  }
  return { attempts, hit: null };
}

export async function verifyEmail(email: string): Promise<boolean> {
  if (!process.env.ZEROBOUNCE_API_KEY) return email.includes("@") && !email.endsWith("@example.com");
  return email.includes("@");
}

export async function mergeAtsFetch(orgId: string) {
  const connection = await firstActiveForRole(orgId, "ats", "ats_list");
  if (!connection) return [];
  const result = await executeIntent({
    orgId,
    toolkit: connection.toolkit,
    connectedAccountId: connection.connected_account_id,
    intent: "ats_list",
    facts: { per_page: 20, limit: 20 },
  });
  return parseAtsPeople(result.data).map((person) => ({
    ...person,
    provider: connection.toolkit,
  }));
}

export async function writeAtsRemote(orgId: string, candidateName: string, _payload: unknown) {
  const connection = await firstActiveForRole(orgId, "ats", "ats_create");
  if (!connection) return { ok: false as const, error: "Connect an ATS on Connections first" };
  const result = await executeIntent({
    orgId,
    toolkit: connection.toolkit,
    connectedAccountId: connection.connected_account_id,
    intent: "ats_create",
    facts: {
      name: candidateName,
      first_name: candidateName.split(" ")[0],
      last_name: candidateName.split(" ").slice(1).join(" ") || candidateName,
    },
  });
  if (result.successful === false) {
    return { ok: false as const, error: result.error ?? "ATS write failed" };
  }
  return { ok: true as const, toolkit: connection.toolkit };
}

export async function sendViaConnectedInbox(input: {
  orgId: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ via: string; ok: boolean; error?: string }> {
  const connection = await firstActiveForRole(input.orgId, "outreach", "send_email");
  if (!connection) return { via: "none", ok: false, error: "Connect an inbox on Connections to send" };
  const result = await executeIntent({
    orgId: input.orgId,
    toolkit: connection.toolkit,
    connectedAccountId: connection.connected_account_id,
    intent: "send_email",
    facts: {
      to: input.to,
      recipient_email: input.to,
      subject: input.subject,
      body: input.body,
      body_text: input.body,
    },
  });
  if (result.successful === false) {
    return { via: connection.toolkit, ok: false, error: result.error ?? "Send failed" };
  }
  return { via: connection.toolkit, ok: true };
}

export { listActiveConnections };
