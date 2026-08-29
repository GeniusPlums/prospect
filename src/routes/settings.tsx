import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { dashboard, runBillingCron, tickAlwaysOn } from "@/lib/server/fns";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof dashboard>> | null>(null);
  useEffect(() => {
    void dashboard().then(setData);
  }, []);
  return (
    <AppShell>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="text-sm">Plan: Pro · Postgres is the meter. Razorpay add-ons push on cron (T-2 days).</p>
        <p className="font-mono text-sm">
          Profiles left {data?.remaining.profiles} · Reveals left {data?.remaining.reveals}
        </p>
        <p className="text-sm text-muted-foreground">
          Used this cycle: {data?.used.profiles} profiles, {data?.used.reveals} reveals. Agent runs are a separate add-on.
        </p>
        <h2 className="text-sm font-medium">Reconciliation</h2>
        <p className="text-sm text-muted-foreground">
          Ledger vs Razorpay add-on pushes appear here after the billing cron. Empty until a cycle closes.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => void runBillingCron()}>Run billing cron</Button>
          <Button variant="outline" onClick={() => void tickAlwaysOn()}>
            Meter an agent run
          </Button>
        </div>
        <ul className="text-sm text-muted-foreground">
          {(data?.automations ?? []).map((a) => (
            <li key={a.id}>
              {a.trigger} → {a.action} {a.enabled ? "on" : "off"}
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
