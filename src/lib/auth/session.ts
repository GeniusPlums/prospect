import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth/server";
import { ensureDbReady, sql } from "@/lib/db";

export function orgIdForUser(userId: string): string {
  return `org_${userId}`;
}

export async function ensureOrg(userId: string, name: string): Promise<string> {
  await ensureDbReady();
  const orgId = orgIdForUser(userId);
  await sql(
    `INSERT INTO org (id, name, plan) VALUES ($1, $2, 'pro') ON CONFLICT (id) DO NOTHING`,
    [orgId, name || "Workspace"],
  );
  return orgId;
}

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const orgId = await ensureOrg(session.user.id, session.user.name || session.user.email);
  return { user: session.user, orgId };
});

export async function requireOrg(): Promise<{ userId: string; orgId: string; email: string; name: string }> {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session) throw new Error("Sign in required");
  const orgId = await ensureOrg(session.user.id, session.user.name || session.user.email);
  return {
    userId: session.user.id,
    orgId,
    email: session.user.email,
    name: session.user.name,
  };
}
