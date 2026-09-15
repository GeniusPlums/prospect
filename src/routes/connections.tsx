import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { connectToolkit, listConnections } from "@/lib/server/fns";
import type { ToolkitLane } from "@/lib/composio/catalog";
import { toast } from "sonner";

export const Route = createFileRoute("/connections")({ component: ConnectionsPage });

const LANES: { id: ToolkitLane; label: string }[] = [
  { id: "hr", label: "HR / ATS" },
  { id: "sourcing", label: "Sourcing" },
  { id: "outreach", label: "Outreach" },
];

function ConnectionsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof listConnections>> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const next = await listConnections();
    setData(next);
    return next;
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onConnect(toolkit: string) {
    setBusy(toolkit);
    try {
      const result = await connectToolkit({ data: { toolkit, origin: window.location.origin } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if ("alreadyConnected" in result && result.alreadyConnected) {
        toast.success("Already connected");
        await refresh();
        return;
      }
      if ("redirectUrl" in result && result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start connect");
    } finally {
      setBusy(null);
    }
  }

  const connected = new Map((data && "connections" in data ? data.connections : []).map((row) => [row.toolkit, row.status]));

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div>
          <h1 className="font-display text-3xl">Connections</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Any connected ATS writes sourced people. Any connected sourcing tool is collected only on cache miss.
            Reveal and send never invent an email or a mailbox.
          </p>
        </div>
        {data && "ok" in data && data.ok === false ? (
          <p className="text-sm">
            <Link to="/sign-in" className="underline">
              Sign in
            </Link>{" "}
            to connect tools.
          </p>
        ) : null}
        {LANES.map((lane) => (
          <section key={lane.id} className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">{lane.label}</h2>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {(data?.catalog ?? []).filter((item) => item.lane === lane.id).map((item) => {
                const status = connected.get(item.slug);
                return (
                  <li key={item.slug} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span>
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.blurb}</span>
                    </span>
                    {status === "active" ? (
                      <span className="font-mono text-[10px] text-muted-foreground">connected</span>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busy === item.slug} onClick={() => void onConnect(item.slug)}>
                        {busy === item.slug ? "Opening…" : status === "pending" ? "Resume" : "Connect"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </AppShell>
  );
}
