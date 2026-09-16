import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { connectToolkit, listConnections, listToolkitCatalog } from "@/lib/server/fns";
import { roleFromCategoryText, type CatalogItem } from "@/lib/composio/catalog";
import { toast } from "sonner";

export const Route = createFileRoute("/connections")({ component: ConnectionsPage });

const ROLE_LABEL: Record<string, string> = {
  llm: "LLM / brain",
  sourcing: "Sourcing / people",
  ats: "ATS / HR",
  outreach: "Outreach / mail",
};

function ConnectionsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof listConnections>> | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  async function refreshConnections() {
    const next = await listConnections();
    setData(next);
    return next;
  }

  async function loadPage(nextCategory: string, cursor?: string, append = false) {
    setLoadingCatalog(true);
    try {
      const page = await listToolkitCatalog({
        data: { category: nextCategory || undefined, cursor },
      });
      setItems((prev) => (append ? [...prev, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load Composio catalog");
    } finally {
      setLoadingCatalog(false);
    }
  }

  useEffect(() => {
    void (async () => {
      const next = await refreshConnections();
      if (next && "ok" in next && next.ok) {
        await loadPage("");
      }
    })();
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
        await refreshConnections();
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

  async function onCategory(id: string) {
    setCategory(id);
    await loadPage(id);
  }

  const connected = new Map((data && "connections" in data ? data.connections : []).map((row) => [row.toolkit, row.status]));
  const categories = data && "categories" in data ? data.categories : [];
  const grouped = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const item of items) {
      const key = item.category || "Other";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div>
          <h1 className="font-display text-3xl">Connections</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect any toolkit Composio lists. Runtime uses the first active toolkit for each job: LLM for grading,
            sourcing for people search, ATS for write-back, inbox for send. Cache-before-collect. Reveal never invents
            an email.
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
              <Button size="sm" variant={category === "" ? "default" : "outline"} onClick={() => void onCategory("")}>
                All
              </Button>
              {categories.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant={category === item.id ? "default" : "outline"}
                  onClick={() => void onCategory(item.id)}
                >
                  {item.name}
                </Button>
              ))}
            </div>
            {grouped.map(([name, list]) => (
              <section key={name} className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">{name}</h2>
                <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                  {list.map((item) => {
                    const status = connected.get(item.slug);
                    const role = roleFromCategoryText(`${item.category} ${item.slug} ${item.label}`);
                    return (
                      <li key={item.slug} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span>
                          <span className="block text-sm font-medium">{item.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.slug}
                            {role ? ` · ${ROLE_LABEL[role]}` : ""}
                            {item.blurb ? ` · ${item.blurb}` : ""}
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
            {loadingCatalog ? <p className="text-sm text-muted-foreground">Loading catalog…</p> : null}
            {nextCursor ? (
              <Button variant="outline" disabled={loadingCatalog} onClick={() => void loadPage(category, nextCursor, true)}>
                Load more
              </Button>
            ) : null}
          </>
        ) : null}
      </main>
    </AppShell>
  );
}
