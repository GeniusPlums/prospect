import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { connectAts, atsWrite } from "@/lib/server/fns";

export const Route = createFileRoute("/ats")({ component: AtsPage });

function AtsPage() {
  const [data, setData] = useState<unknown>(null);
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <h1 className="font-display text-3xl">ATS (Merge)</h1>
        <p className="text-sm text-muted-foreground">
          Unified ATS adapter. Without MERGE_API_KEY this uses a local fixture and merges on name.
        </p>
        <Button onClick={() => void connectAts().then(setData)}>Sync Merge</Button>
        <Button variant="outline" onClick={() => void atsWrite({ data: { candidateId: "aditya-iyer" } })}>
          Write sourced candidate
        </Button>
        {data ? <pre className="font-mono text-xs">{JSON.stringify(data, null, 2)}</pre> : null}
      </main>
    </AppShell>
  );
}
