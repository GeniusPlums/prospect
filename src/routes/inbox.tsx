import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { listSearches, screen } from "@/lib/server/fns";

export const Route = createFileRoute("/inbox")({ component: InboxPage });

function InboxPage() {
  const [icpId, setIcpId] = useState("");
  const [resume, setResume] = useState("");
  const [result, setResult] = useState<unknown>(null);
  return (
    <AppShell>
      <main className="mx-auto max-w-xl space-y-4 px-4 py-10">
        <h1 className="font-display text-3xl">Inbound screening</h1>
        <p className="text-sm text-muted-foreground">Same ICP object as sourcing.</p>
        <Input placeholder="ICP version id" value={icpId} onChange={(e) => setIcpId(e.target.value)} />
        <Textarea className="min-h-40" value={resume} onChange={(e) => setResume(e.target.value)} placeholder="Paste resume" />
        <Button
          onClick={async () => {
            if (!icpId) {
              const searches = await listSearches();
              const first = searches[0];
              if (first) setIcpId(first.icp_version_id);
            }
            const r = await screen({ data: { icpId, resumeText: resume } });
            setResult(r);
          }}
        >
          Screen against ICP
        </Button>
        {result ? <pre className="font-mono text-xs">{JSON.stringify(result, null, 2)}</pre> : null}
      </main>
    </AppShell>
  );
}
