import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { dashboard, persistEval } from "@/lib/server/fns";

export const Route = createFileRoute("/evals")({ component: EvalsPage });

function EvalsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof dashboard>> | null>(null);
  useEffect(() => {
    void dashboard().then(setData);
  }, []);
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <h1 className="font-display text-3xl">Eval harness</h1>
        <Button
          onClick={async () => {
            await persistEval();
            setData(await dashboard());
          }}
        >
          Run suite
        </Button>
        <ul className="space-y-2 font-mono text-xs">
          {(data?.evals ?? []).map((e) => (
            <li key={e.id}>
              P@5 {e.p_at_5} · NDCG {e.ndcg10} · {e.passed ? "pass" : "fail"} — {e.notes}
            </li>
          ))}
        </ul>
        {(data?.evals?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No eval runs stored yet. Run the suite.</p>
        ) : null}
      </main>
    </AppShell>
  );
}
