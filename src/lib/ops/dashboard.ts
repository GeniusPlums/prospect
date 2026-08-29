import { sql } from "@/lib/db";
import { nid } from "@/lib/ids";
import { recordUsage } from "@/lib/billing/meter";

export async function listAutomations(orgId: string) {
  return sql<{ id: string; trigger: string; action: string; enabled: boolean }>(
    `SELECT id, trigger, action, enabled FROM automation WHERE org_id=$1`,
    [orgId],
  );
}

export async function ensureDefaultAutomations(orgId: string) {
  const existing = await listAutomations(orgId);
  if (existing.length) return existing;
  const defaults = [
    { trigger: "ats.stage.hired", action: "recalibrate_ranking" },
    { trigger: "saved_search.match", action: "notify" },
    { trigger: "always_on.tick", action: "rerun_stage1" },
  ];
  for (const d of defaults) {
    await sql(
      `INSERT INTO automation (id, org_id, trigger, action, enabled) VALUES ($1,$2,$3,$4,true)`,
      [nid("aut"), orgId, d.trigger, d.action],
    );
  }
  return listAutomations(orgId);
}

export async function fireAlwaysOn(orgId: string) {
  await recordUsage(orgId, "agent_run", 1);
  await sql(
    `INSERT INTO pipeline_event (id, search_run_id, step, message, counts)
     SELECT $1, id, 'always_on', 'Cache-only re-run queued', '{}'::jsonb FROM search_run WHERE org_id=$2 ORDER BY created_at DESC LIMIT 1`,
    [nid("evt"), orgId],
  );
}

export async function precisionOverTime(orgId: string) {
  return sql<{ day: string; kept: string; total: string }>(
    `SELECT to_char(date_trunc('day', f.created_at), 'YYYY-MM-DD') as day,
            sum(case when f.vote='up' then 1 else 0 end)::text as kept,
            count(*)::text as total
     FROM feedback f
     JOIN search_run r ON r.id = f.search_run_id
     WHERE r.org_id=$1
     GROUP BY 1 ORDER BY 1`,
    [orgId],
  );
}

export async function cacheHitRate(orgId: string) {
  const row = await sql<{ hits: string; misses: string }>(
    `SELECT coalesce(sum(cache_hits),0)::text as hits, coalesce(sum(cache_misses),0)::text as misses
     FROM search_run WHERE org_id=$1`,
    [orgId],
  );
  const hits = Number(row[0]?.hits ?? 0);
  const misses = Number(row[0]?.misses ?? 0);
  const total = hits + misses;
  return { hits, misses, rate: total === 0 ? null : hits / total };
}

export async function criteriaContradiction(_orgId: string) {
  return { visible: false, body: null as string | null };
}
