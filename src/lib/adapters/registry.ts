import { localSource, remotePeople } from "./profile-source/active";
import type { PeopleSource } from "./profile-source/types";
import { executeIntent, firstActive, listActiveConnections } from "@/lib/composio/client";
import { findEmail, parseAtsPeople } from "@/lib/composio/parse";
import { composioPeopleSource } from "@/lib/composio/people";

export function peopleSource(): PeopleSource {
  const mode = process.env.PROSPECT_PEOPLE_PROVIDER ?? "local";
  if (mode === "local") return localSource;
  return remotePeople;
}

export async function peopleSourceForOrg(orgId: string): Promise<PeopleSource> {
  return (await composioPeopleSource(orgId)) ?? peopleSource();
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
  const vendors = [
    { toolkit: "hunter", needles: ["email", "find"], costUsd: 0.1 },
    { toolkit: "peopledatalabs", needles: ["enrich", "email"], costUsd: 0.15 },
    { toolkit: "apollo", needles: ["email", "people"], costUsd: 0.1 },
  ] as const;

  for (const vendor of vendors) {
    const connection = await firstActive(input.orgId, [vendor.toolkit]);
    if (!connection) {
      attempts.push({ provider: vendor.toolkit, outcome: "skipped_not_connected", costUsd: 0 });
      continue;
    }
    const result = await executeIntent({
      orgId: input.orgId,
      toolkit: connection.toolkit,
      connectedAccountId: connection.connected_account_id,
      needles: [...vendor.needles],
      arguments: {
        full_name: input.name,
        name: input.name,
        domain: input.domain ?? "",
        company: input.domain ?? "",
      },
    });
    const email = findEmail(result.data);
    if (email) {
      attempts.push({ provider: vendor.toolkit, outcome: "hit", costUsd: vendor.costUsd });
      return { attempts, hit: { email, provider: vendor.toolkit, costUsd: vendor.costUsd } };
    }
    attempts.push({
      provider: vendor.toolkit,
      outcome: result.successful === false ? "error" : "miss",
      costUsd: vendor.costUsd,
    });
  }
  return { attempts, hit: null };
}

export async function verifyEmail(email: string): Promise<boolean> {
  if (!process.env.ZEROBOUNCE_API_KEY) return email.includes("@") && !email.endsWith("@example.com");
  return email.includes("@");
}

export async function mergeAtsFetch(orgId: string) {
  const connection = await firstActive(orgId, ["greenhouse", "lever", "ashby", "workday", "bamboohr"]);
  if (!connection) return [];
  const result = await executeIntent({
    orgId,
    toolkit: connection.toolkit,
    connectedAccountId: connection.connected_account_id,
    needles: ["list", "candidate"],
    arguments: { per_page: 20, limit: 20 },
  });
  return parseAtsPeople(result.data).map((person) => ({
    ...person,
    provider: connection.toolkit,
  }));
}

export async function writeAtsRemote(orgId: string, candidateName: string, payload: unknown) {
  const connection = await firstActive(orgId, ["greenhouse", "lever", "ashby", "workday", "bamboohr"]);
  if (!connection) return { ok: false as const, error: "Connect an ATS on Connections first" };
  const result = await executeIntent({
    orgId,
    toolkit: connection.toolkit,
    connectedAccountId: connection.connected_account_id,
    needles: ["create", "candidate"],
    arguments: {
      name: candidateName,
      first_name: candidateName.split(" ")[0],
      last_name: candidateName.split(" ").slice(1).join(" ") || candidateName,
      payload,
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
}): Promise<{ via: "gmail" | "outlook" | "none"; ok: boolean; error?: string }> {
  const connection = await firstActive(input.orgId, ["gmail", "outlook"]);
  if (!connection) return { via: "none", ok: false, error: "Connect Gmail or Outlook to send" };
  const result = await executeIntent({
    orgId: input.orgId,
    toolkit: connection.toolkit,
    connectedAccountId: connection.connected_account_id,
    needles: ["send", "email"],
    arguments: {
      to: input.to,
      recipient_email: input.to,
      subject: input.subject,
      body: input.body,
      body_text: input.body,
    },
  });
  if (result.successful === false) {
    return { via: connection.toolkit as "gmail" | "outlook", ok: false, error: result.error ?? "Send failed" };
  }
  return { via: connection.toolkit as "gmail" | "outlook", ok: true };
}

export async function completeLlm(promptName: string, input: string): Promise<string | null> {
  void promptName;
  void input;
  const { completeJson } = await import("@/lib/ai/complete");
  const result = await completeJson({
    name: promptName,
    system: "Return the requested text only.",
    user: input,
  });
  return result.ok ? result.text : null;
}

export { listActiveConnections };
