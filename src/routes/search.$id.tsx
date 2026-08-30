import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PipelineRun } from "@/components/prospect/pipeline";
import { Button } from "@/components/ui/button";
import { loadSearch, runSearchPipeline, voteCandidate, doReveal, loadOutreach, doSend } from "@/lib/server/fns";
import { getCandidate } from "@/lib/data/candidates";
import { PersonAvatar } from "@/components/prospect/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/search/$id")({ component: SearchPage });

type ScoreRow = {
  id: string;
  candidate_id: string;
  case_for: string;
  case_against: string;
  unclear: unknown;
  verdict: string;
  disqualified: boolean;
  disqualifier_flags: unknown;
  for_weight: number;
  against_weight: number;
  unclear_weight: number;
  final_rank: number | null;
  held_back: boolean;
  held_back_rules: unknown;
  model_version: string;
  prompt_version: string;
  icp_version_id: string;
};

function VerdictBar({ forW, againstW, unclearW }: { forW: number; againstW: number; unclearW: number }) {
  const s = Math.max(0.001, forW + againstW + unclearW);
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-secondary" aria-label="Verdict for, against, unclear">
      <span className="bg-for" style={{ width: `${(forW / s) * 100}%` }} />
      <span className="bg-against" style={{ width: `${(againstW / s) * 100}%` }} />
      <span className="bg-unclear" style={{ width: `${(unclearW / s) * 100}%` }} />
    </div>
  );
}

function SearchPage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadSearch>> | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [email, setEmail] = useState<string | null>(null);

  async function refresh() {
    const next = await loadSearch({ data: { id } });
    setData(next);
    return next;
  }

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function kick() {
      const first = await loadSearch({ data: { id } });
      if (cancelled) return;
      setData(first);
      if (first.ok && first.run.status === "running") {
        try {
          await runSearchPipeline({ data: { id } });
        } catch (err) {
          if (!cancelled) toast.error(err instanceof Error ? err.message : "Pipeline failed");
        }
        if (!cancelled) {
          const done = await loadSearch({ data: { id } });
          if (!cancelled) setData(done);
        }
      }
    }

    async function poll() {
      while (!cancelled) {
        await new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 400);
        });
        if (cancelled) return;
        const next = await loadSearch({ data: { id } });
        if (cancelled) return;
        setData(next);
        if (!next.ok || next.run.status !== "running") return;
      }
    }

    void kick();
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  const scores = (data && data.ok ? (data.scores as ScoreRow[]) : []) ?? [];
  const open = scores.filter((s) => !s.held_back);
  const held = scores.filter((s) => s.held_back);
  const selected = scores.find((s) => s.candidate_id === selectedId);
  const objections = useMemo(() => {
    if (!data || !data.ok || !selected) return [];
    return data.objections.filter((o) => o.candidate_score_id === selected.id);
  }, [data, selected]);

  if (!data) {
    return (
      <AppShell>
        <main className="px-6 py-24 text-sm text-muted-foreground">Loading search…</main>
      </AppShell>
    );
  }
  if (!data.ok) {
    return (
      <AppShell>
        <main className="mx-auto max-w-xl px-6 py-24 text-center">
          <h1 className="font-display text-3xl">This search isn’t here</h1>
          <Link to="/" className="mt-6 inline-flex underline">
            New search
          </Link>
        </main>
      </AppShell>
    );
  }

  if (data.run.status === "running") {
    return (
      <AppShell crumb={data.icp?.title}>
        <PipelineRun events={data.events} />
      </AppShell>
    );
  }

  return (
    <AppShell wide lock crumb={data.icp?.title} action={<Link to="/">New search</Link>}>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-full flex-col overflow-y-auto border-r border-border lg:w-96">
          <p className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
            cache {data.run.cache_hits} hit / {data.run.cache_misses} miss
          </p>
          {open.map((row) => {
            const person = getCandidate(row.candidate_id);
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.candidate_id)}
                className={cn(
                  "flex gap-3 border-b border-border px-4 py-3 text-left",
                  selectedId === row.candidate_id && "bg-accent",
                )}
              >
                <PersonAvatar name={person?.name ?? row.candidate_id} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    #{String(row.final_rank ?? "—").padStart(2, "0")} {person?.name}
                  </span>
                  <span className="block font-mono text-[10px] text-muted-foreground">
                    icp {data.icp?.version} · {row.model_version} · {row.prompt_version}
                  </span>
                </span>
              </button>
            );
          })}
          {held.length > 0 ? (
            <section className="border-t-2 border-block p-4">
              <h2 className="text-xs font-medium text-block">Held back</h2>
              {held.map((row) => (
                <p key={row.id} className="mt-2 text-sm">
                  {getCandidate(row.candidate_id)?.name} — {JSON.stringify(row.held_back_rules)}
                </p>
              ))}
            </section>
          ) : null}
        </aside>
        <section className="hidden min-w-0 flex-1 overflow-y-auto p-6 lg:block">
          {selected ? (
            <DossierPanel
              searchId={id}
              row={selected}
              objections={objections}
              email={email}
              onVote={async (vote, tags) => {
                const res = await voteCandidate({
                  data: { searchId: id, candidateId: selected.candidate_id, vote: { vote, tags } },
                });
                if (res.proposed) toast.message("ICP change proposed — accept in Rules");
                await refresh();
              }}
              onReveal={async () => {
                const res = await doReveal({ data: { searchId: id, candidateId: selected.candidate_id } });
                if (res.ok) setEmail(res.email);
                else toast.error(res.error);
              }}
              onSend={async () => {
                const draft = await loadOutreach({ data: { searchId: id, candidateId: selected.candidate_id } });
                if (!draft || !email) return;
                await doSend({
                  data: {
                    searchId: id,
                    candidateId: selected.candidate_id,
                    to: email,
                    subject: draft.subject,
                    body: draft.body,
                    facts: draft.personalizationFacts,
                  },
                });
                toast.success("Queued to inbox");
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Open the strongest match.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function DossierPanel({
  row,
  objections,
  email,
  onVote,
  onReveal,
  onSend,
}: {
  searchId: string;
  row: ScoreRow;
  objections: { claim: string; objection: string }[];
  email: string | null;
  onVote: (vote: "up" | "down", tags: string[]) => void;
  onReveal: () => void;
  onSend: () => void;
}) {
  const person = getCandidate(row.candidate_id);
  const unclear = (() => {
    if (Array.isArray(row.unclear)) return row.unclear as string[];
    if (typeof row.unclear === "string") {
      try {
        const parsed = JSON.parse(row.unclear) as unknown;
        return Array.isArray(parsed) ? (parsed as string[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  })();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl">{person?.name}</h1>
        <p className="text-sm text-muted-foreground">{person?.headline}</p>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          icp {row.icp_version_id.slice(-6)} · {row.model_version} · {row.prompt_version}
        </p>
      </div>
      <VerdictBar forW={row.for_weight} againstW={row.against_weight} unclearW={row.unclear_weight} />
      <section className="border-l-2 border-for pl-4">
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Case for</h2>
        <p className="mt-2 text-sm">{row.case_for}</p>
      </section>
      <section className="border-l-2 border-against pl-4">
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Case against</h2>
        <p className="mt-2 text-sm">{row.case_against}</p>
      </section>
      <section className="border-l-2 border-dashed border-unclear pl-4">
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Unclear</h2>
        <ul className="mt-2 list-disc pl-4 text-sm">
          {unclear.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
      </section>
      <aside className="border-l-2 border-objection pl-4">
        <h2 className="text-xs uppercase tracking-[0.14em] text-objection">Reviewer objections</h2>
        {objections.map((o) => (
          <p key={o.claim} className="mt-2 text-sm">
            <span className="font-medium">{o.claim}</span> {o.objection}
          </p>
        ))}
      </aside>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onVote("up", ["strong signal"])}>Keep</Button>
        <Button variant="outline" onClick={() => onVote("down", ["skills miss"])}>
          Pass
        </Button>
        <Button variant="secondary" onClick={() => void onReveal()}>
          Reveal contact
        </Button>
        {email ? (
          <Button variant="outline" onClick={() => void onSend()}>
            Send from inbox
          </Button>
        ) : null}
      </div>
      {email ? <p className="font-mono text-sm">{email}</p> : null}
    </div>
  );
}
