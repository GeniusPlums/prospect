import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectToolkit, listConnections, listToolkitCatalog } from "@/lib/server/fns";
import { LANE_LABEL, LANE_ORDER, type CatalogItem, type RuntimeRole } from "@/lib/composio/catalog";
import { toast } from "sonner";

export const Route = createFileRoute("/connections")({
  validateSearch: (search: Record<string, unknown>): { connected?: string } => ({
    connected: typeof search.connected === "string" ? search.connected : undefined,
  }),
  component: ConnectionsPage,
});

function ConnectionsPage() {
  const { connected: justConnected } = Route.useSearch();
  const [data, setData] = useState<Awaited<ReturnType<typeof listConnections>> | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [lane, setLane] = useState<RuntimeRole | "">("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  async function refreshConnections() {
    const next = await listConnections();
    setData(next);
    return next;
  }

  async function loadCatalog() {
    setLoadingCatalog(true);
    setCatalogError(null);
    setItems([]);
    try {
      const page = await listToolkitCatalog();
      if (!page.ok) {
        setCatalogError(page.error || "Could not load Composio catalog");
        return;
      }
      setItems(page.items);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Could not load Composio catalog");
    } finally {
      setLoadingCatalog(false);
    }
  }

  useEffect(() => {
    if (justConnected === "1") toast.success("Returned from hosted OAuth. Refreshing connections…");
    void (async () => {
      const next = await refreshConnections();
      if (next && "ok" in next && next.ok) {
        await loadCatalog();
      }
    })();
  }, [justConnected]);

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
        await refreshConnections();
        return;
      }
      if ("redirectUrl" in result && result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      toast.error("Composio did not return a hosted auth URL");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start connect");
    } finally {
      setBusy(null);
    }
  }

  const connected = new Map((data && "connections" in data ? data.connections : []).map((row) => [row.toolkit, row.status]));
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (lane && item.lane !== lane) return false;
      if (!needle) return true;
      return `${item.label} ${item.slug} ${item.blurb}`.toLowerCase().includes(needle);
    });
  }, [items, lane, query]);

  const grouped = useMemo(() => {
    return LANE_ORDER.map((id) => ({
      id,
      name: LANE_LABEL[id],
      list: filtered.filter((item) => item.lane === id),
    })).filter((group) => group.list.length > 0);
  }, [filtered]);

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div>
          <h1 className="font-display text-3xl">Connections</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Live Composio catalog. Hiring lanes only: LLM, sourcing/people, ATS/HRIS, outreach/mail. No Popular. No
            DevOps. Connect opens hosted OAuth. Tokens stay on Composio.
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
        {data && "configured" in data && data.ok && !data.configured ? (
          <p className="text-sm text-muted-foreground">Composio is not configured on this deployment.</p>
        ) : null}

        {connected.size > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Connected</h2>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {[...connected.entries()].map(([slug, status]) => (
                <li key={slug} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm font-medium">{slug}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{status}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data && "ok" in data && data.ok ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={lane === "" ? "default" : "outline"} onClick={() => setLane("")}>
                All hiring
              </Button>
              {LANE_ORDER.map((id) => (
                <Button
                  key={id}
                  size="sm"
                  variant={lane === id ? "default" : "outline"}
                  onClick={() => setLane(id)}
                >
                  {LANE_LABEL[id]}
                </Button>
              ))}
            </div>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search toolkits"
              aria-label="Filter toolkits"
            />
            {catalogError ? (
              <p className="text-sm text-destructive">
                Could not load Composio catalog
                {catalogError ? `: ${catalogError}` : "."}
              </p>
            ) : null}
            {grouped.map((group) => (
              <section key={group.id} className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">{group.name}</h2>
                <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                  {group.list.map((item) => {
                    const status = connected.get(item.slug);
                    return (
                      <li key={item.slug} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span>
                          <span className="block text-sm font-medium">{item.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.lane === "sourcing" && status !== "active"
                              ? "Required to search"
                              : item.blurb || item.slug}
                          </span>
                        </span>
                        {status === "active" ? (
                          <span className="font-mono text-[10px] text-muted-foreground">connected</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === item.slug}
                            onClick={() => void onConnect(item.slug)}
                          >
                            {busy === item.slug ? "Opening…" : status === "pending" ? "Resume" : "Connect"}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {loadingCatalog ? <p className="text-sm text-muted-foreground">Loading Composio catalog…</p> : null}
            {!loadingCatalog && !catalogError && items.length > 0 && grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hiring toolkits match that filter.</p>
            ) : null}
          </>
        ) : null}
      </main>
    </AppShell>
  );
}
