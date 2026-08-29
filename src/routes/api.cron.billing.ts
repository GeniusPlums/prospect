import { createFileRoute } from "@tanstack/react-router";
import { ensureDbReady } from "@/lib/db";
import { pushAddonsForCycle } from "@/lib/billing/meter";
import { DEV_ORG } from "@/lib/ids";

export const Route = createFileRoute("/api/cron/billing")({
  server: {
    handlers: {
      GET: async () => {
        await ensureDbReady();
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + 2);
        const cycle = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        await pushAddonsForCycle(DEV_ORG, "sub_local", cycle);
        return new Response(JSON.stringify({ ok: true, cycle }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
