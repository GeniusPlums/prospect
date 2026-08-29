import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadRules, saveRules } from "@/lib/server/fns";

export const Route = createFileRoute("/rules")({ component: RulesPage });

function RulesPage() {
  const [must, setMust] = useState("");
  const [nice, setNice] = useState("");
  const [dq, setDq] = useState("");
  const [current, setCurrent] = useState<Awaited<ReturnType<typeof loadRules>>>(null);
  useEffect(() => {
    void loadRules().then(setCurrent);
  }, []);
  return (
    <AppShell>
      <main className="mx-auto max-w-xl space-y-4 px-4 py-10">
        <h1 className="font-display text-3xl">Org hiring rules</h1>
        <p className="text-sm text-muted-foreground">
          Inherited into every role ICP. Versions are immutable; this write is a new accepted version.
        </p>
        {current ? (
          <pre className="rounded-lg bg-secondary p-3 font-mono text-xs">{JSON.stringify(current, null, 2)}</pre>
        ) : (
          <p className="text-sm text-muted-foreground">No accepted org rules yet.</p>
        )}
        <Input placeholder="Must (comma separated)" value={must} onChange={(e) => setMust(e.target.value)} />
        <Input placeholder="Nice" value={nice} onChange={(e) => setNice(e.target.value)} />
        <Input placeholder="Disqualifiers" value={dq} onChange={(e) => setDq(e.target.value)} />
        <Button
          onClick={() =>
            void saveRules({
              data: {
                must: must.split(",").map((s) => s.trim()).filter(Boolean),
                nice: nice.split(",").map((s) => s.trim()).filter(Boolean),
                disqualifiers: dq.split(",").map((s) => s.trim()).filter(Boolean),
              },
            }).then((r) => setCurrent(r.current))
          }
        >
          Publish rules
        </Button>
      </main>
    </AppShell>
  );
}
