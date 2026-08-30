import { createFileRoute } from "@tanstack/react-router";
import { ensureDbReady } from "@/lib/db";

export const Route = createFileRoute("/api/cron/refresh")({
  server: {
    handlers: {
      GET: async () => {
        await ensureDbReady();
        return new Response(JSON.stringify({ ok: true, staleTopUp: 0 }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
