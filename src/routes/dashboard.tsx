import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { dashboard, tickAlwaysOn } from "@/lib/server/fns";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard")({ component: DashPage });

function DashPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof dashboard>> | null>(null);
  useEffect(() => {
    void dashboard().then(setData);
  }, []);
  const cache = data?.cache;
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
        <h1 className="font-display text-3xl">Precision</h1>
        <section>
          <h2 className="text-sm font-medium">Cache hit rate</h2>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            {cache?.rate == null ? "Unknown until real query patterns exist." : `${Math.round(cache.rate * 100)}% (${cache.hits} / ${cache.hits + cache.misses})`}
          </p>
        </section>
        <section>
          <h2 className="text-sm font-medium">Precision over time</h2>
          {(data?.precision.length ?? 0) === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Empty until there is search history.</p>
          ) : (
            <ul className="mt-2 font-mono text-xs">
              {data!.precision.map((p) => (
                <li key={p.day}>
                  {p.day}: {p.kept}/{p.total} kept
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="text-sm font-medium">Stated criteria vs decisions</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {data?.insight.visible ? data.insight.body : "Silent until enough hires exist to detect a contradiction."}
          </p>
        </section>
        <section>
          <h2 className="text-sm font-medium">Outcome calibration</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Working, uncalibrated. Falls back to exemplar-only until real hires exist.
          </p>
        </section>
        <Button onClick={() => void tickAlwaysOn()}>Run always-on (agent add-on)</Button>
      </main>
    </AppShell>
  );
}
