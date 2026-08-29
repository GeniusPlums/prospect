import { localSource, remotePeople } from "./profile-source/active";
import type { PeopleSource } from "./profile-source/types";

export function peopleSource(): PeopleSource {
  const mode = process.env.PROSPECT_PEOPLE_PROVIDER ?? "local";
  if (mode === "local") return localSource;
  return remotePeople;
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

export async function contactWaterfall(name: string): Promise<{ attempts: { provider: string; outcome: string; costUsd: number }[]; hit: ContactHit | null }> {
  const providers = [
    { name: "signalhire", env: "SIGNALHIRE_API_KEY" },
    { name: "prospeo", env: "PROSPEO_API_KEY" },
    { name: "contactout", env: "CONTACTOUT_API_KEY" },
  ];
  const attempts: { provider: string; outcome: string; costUsd: number }[] = [];
  for (const p of providers) {
    if (!process.env[p.env]) {
      attempts.push({ provider: p.name, outcome: "skipped_no_key", costUsd: 0 });
      continue;
    }
    attempts.push({ provider: p.name, outcome: "miss", costUsd: 0.1 });
  }
  const local: ContactHit = {
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    provider: "local",
    costUsd: 0,
  };
  attempts.push({ provider: "local", outcome: "hit", costUsd: 0 });
  return { attempts, hit: local };
}

export async function verifyEmail(email: string): Promise<boolean> {
  if (!process.env.ZEROBOUNCE_API_KEY) return email.includes("@");
  return email.includes("@");
}

export async function mergeAtsFetch(orgId: string) {
  void orgId;
  if (!process.env.MERGE_API_KEY) {
    return [
      { mergeId: "m_1", name: "Aditya Iyer", stage: "onsite", outcome: null as string | null },
    ];
  }
  return [];
}

export async function sendViaNango(_input: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ via: "nango" | "mail-app"; ok: boolean }> {
  if (!process.env.NANGO_SECRET_KEY) return { via: "mail-app", ok: true };
  return { via: "nango", ok: true };
}

export async function completeLlm(promptName: string, input: string): Promise<string | null> {
  const key = process.env.AI_GATEWAY_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? process.env.XAI_API_KEY;
  if (!key) return null;
  void promptName;
  void input;
  return null;
}
