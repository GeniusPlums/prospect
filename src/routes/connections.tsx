import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectToolkit, listConnections, listToolkitCatalog } from "@/lib/server/fns";
import { LANE_LABEL, LANE_ORDER, type CatalogItem, type RuntimeRole } from "@/lib/composio/catalog";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";

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
        setCatalogError(page.error || "Could not load your tools");
        return;
      }
      setItems(page.items);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Could not load your tools");
    } finally {
      setLoadingCatalog(false);
    }
  }

  useEffect(() => {
    if (justConnected === "1") toast.success("Returned from sign-in. Refreshing connections…");
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
        toast.success("Already signed in");
        await refreshConnections();
        return;
      }
      if ("redirectUrl" in result && result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      toast.error("No hosted auth URL was returned");
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

  const { data: session } = authClient.useSession();
  const signedOut = !session?.user || (data && "ok" in data && data.ok === false);
  const notConfigured = data && "configured" in data && data.ok && !data.configured;

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6">
        <div className="border-b border-border pb-6">
          <h1 className="font-display text-4xl">Connections</h1>
          <p className="mt-3 max-w-lg font-sans text-lg leading-snug">
            Connect a people source, an inbox, an ATS, and a model. Connect opens hosted sign-in
            (OAuth or API key). If a tool cannot sign in, you see that error.
          </p>
        </div>
        {signedOut ? (
          <p className="border border-dashed border-border px-4 py-8 font-ui text-sm">
            <Link to="/sign-in" className="underline underline-offset-4">
              Sign in
            </Link>{" "}
            to connect tools. Empty is allowed — there is no dummy catalog.
          </p>
        ) : null}
        {notConfigured ? (
          <p className="border border-border bg-card px-4 py-5 font-ui text-sm">
            Connections are not configured on this deployment. The desk is here; the OAuth host is not.
          </p>
        ) : null}

        {connected.size > 0 ? (
          <section>
            <h2 className="font-display text-2xl">Signed in</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {[...connected.entries()].map(([slug, status]) => (
                <li key={slug} className="flex items-center justify-between gap-3 py-3">
                  <span className="font-ui text-sm">{slug}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{status}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data && "ok" in data && data.ok ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 font-ui text-sm">
              <button
                type="button"
                className={lane === "" ? "text-stamp underline underline-offset-4" : "text-muted-foreground"}
                onClick={() => setLane("")}
              >
                All hiring
              </button>
              {LANE_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={lane === id ? "text-stamp underline underline-offset-4" : "text-muted-foreground"}
                  onClick={() => setLane(id)}
                >
                  {LANE_LABEL[id]}
                </button>
              ))}
            </div>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a tool"
              aria-label="Filter tools"
            />
            {catalogError ? (
              <p className="border border-destructive/40 bg-card px-4 py-5 font-ui text-sm text-destructive">
                Could not load your tools: {catalogError}
              </p>
            ) : null}
            {grouped.map((group) => (
              <section key={group.id}>
                <h2 className="font-display text-2xl">{group.name}</h2>
                <ul className="mt-3 divide-y divide-border border-y border-border">
                  {group.list.map((item) => {
                    const status = connected.get(item.slug);
                    return (
                      <li key={item.slug} className="flex items-center justify-between gap-3 py-3">
                        <span>
                          <span className="block font-ui text-sm">{item.label}</span>
                          <span className="font-ui text-xs text-muted-foreground">{item.blurb || item.slug}</span>
                        </span>
                        {status === "active" ? (
                          <span className="font-mono text-[10px] text-stamp">signed in</span>
                        ) : !item.connectable ? (
                          <span className="max-w-[14rem] text-right font-ui text-xs text-destructive">
                            {item.connectError || "Cannot connect"}
                          </span>
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
            {loadingCatalog ? <p className="font-ui text-sm text-muted-foreground">Loading your tools…</p> : null}
            {!loadingCatalog && !catalogError && items.length > 0 && grouped.length === 0 ? (
              <p className="font-ui text-sm text-muted-foreground">No hiring tools match that filter.</p>
            ) : null}
            {!loadingCatalog && !catalogError && items.length === 0 && !signedOut && !notConfigured ? (
              <p className="border border-dashed border-border px-4 py-8 font-ui text-sm text-muted-foreground">
                No hiring tools in this catalog yet. Empty is allowed.
              </p>
            ) : null}
          </>
        ) : null}
      </main>
    </AppShell>
  );
}
