import { sql } from "@/lib/db";
import { DEV_ORG, billingCycle, nid } from "@/lib/ids";

export const PLANS = {
  free: { profiles: 100, reveals: 0, agentRuns: 0 },
  pro: { profiles: 300, reveals: 50, agentRuns: 0 },
  team: { profiles: 700, reveals: 150, agentRuns: 0 },
  scale: { profiles: 1500, reveals: 400, agentRuns: 0 },
} as const;

export type PlanId = keyof typeof PLANS;
export type UsageType = "profile" | "reveal" | "agent_run";

export async function recordUsage(orgId: string, usageType: UsageType, quantity: number) {
  if (quantity <= 0) return;
  await sql(
    `INSERT INTO usage_ledger (id, org_id, usage_type, quantity, cycle) VALUES ($1,$2,$3,$4,$5)`,
    [nid("use"), orgId, usageType, quantity, billingCycle()],
  );
}

export async function usageInCycle(orgId: string, usageType: UsageType, cycle = billingCycle()) {
  const row = await sql<{ n: string }>(
    `SELECT coalesce(sum(quantity),0)::text as n FROM usage_ledger WHERE org_id=$1 AND usage_type=$2 AND cycle=$3`,
    [orgId, usageType, cycle],
  );
  return Number(row[0]?.n ?? 0);
}

export async function remaining(orgId: string, plan: PlanId, usageType: UsageType) {
  const cap =
    usageType === "profile" ? PLANS[plan].profiles : usageType === "reveal" ? PLANS[plan].reveals : PLANS[plan].agentRuns;
  const used = await usageInCycle(orgId, usageType);
  return Math.max(0, cap - used);
}

export async function pushAddonsForCycle(orgId: string, subscriptionId: string, cycle: string) {
  const types: UsageType[] = ["profile", "reveal", "agent_run"];
  const prices = { profile: 40, reveal: 20, agent_run: 400 };
  const included = PLANS.pro;
  for (const usageType of types) {
    const used = await usageInCycle(orgId, usageType, cycle);
    const free =
      usageType === "profile" ? included.profiles : usageType === "reveal" ? included.reveals : included.agentRuns;
    const overage = Math.max(0, used - free);
    if (overage === 0) continue;
    await sql(
      `INSERT INTO razorpay_addon_push (id, subscription_id, cycle, usage_type, quantity, amount_paise)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (subscription_id, cycle, usage_type) DO NOTHING`,
      [nid("add"), subscriptionId, cycle, usageType, overage, overage * prices[usageType] * 100],
    );
  }
}

export { DEV_ORG };
