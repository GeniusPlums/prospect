import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { listSearches } from "@/lib/server/fns";

export const Route = createFileRoute("/searches")({ component: SearchesPage });

function SearchesPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listSearches>>>([]);
  useEffect(() => {
    void listSearches().then(setRows);
  }, []);
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl">Searches</h1>
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to="/search/$id"
                params={{ id: r.id }}
                className="flex min-h-14 items-center justify-between px-4 py-3"
              >
                <span>
                  <span className="block font-medium">{r.title}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {r.cache_hits} hit / {r.cache_misses} miss
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{r.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
