import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { connectAts } from "@/lib/server/fns";

export const Route = createFileRoute("/ats")({ component: AtsPage });

function AtsPage() {
  const [data, setData] = useState<unknown>(null);
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <h1 className="font-display text-3xl">ATS</h1>
        <p className="text-sm text-muted-foreground">
          Syncs an ATS only if Connections has a signed-in ATS with a tool we can actually call. Writes happen from a
          shortlist person, never a fixture like Aditya Iyer. Nothing is invented when the ATS cannot run.
        </p>
        <Button onClick={() => void connectAts().then(setData)}>Sync ATS</Button>
        {data ? <pre className="overflow-auto font-mono text-xs">{JSON.stringify(data, null, 2)}</pre> : null}
      </main>
    </AppShell>
  );
}
