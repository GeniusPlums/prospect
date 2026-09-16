import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PipelineRun } from "@/components/prospect/pipeline";
import { Button } from "@/components/ui/button";
import { loadSearch, runSearchPipeline, voteCandidate, doReveal, loadOutreach, doSend, acceptProposedIcp, atsWrite } from "@/lib/server/fns";
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
  const [proposedId, setProposedId] = useState<string | null>(null);

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
          const ran = await runSearchPipeline({ data: { id } });
          if (ran && "ok" in ran && ran.ok === false && !cancelled) {
            toast.error(ran.error);
            if (ran.error === "Sign in required") {
              window.location.href = "/sign-in";
            }
          }
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
  const people = new Map(
    data && data.ok ? data.people.map((person) => [person.id, person] as const) : [],
  );
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
            cache {data.run.cache_hits} hit / {data.run.cache_misses} miss · spend {data.run.profiles_charged} profiles
          </p>
          {open.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No one passed. That is the result. We do not pad the list.
            </p>
          ) : null}
          {open.map((row) => {
            const name = people.get(row.candidate_id)?.display_name ?? row.candidate_id;
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
                <PersonAvatar name={name} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    #{String(row.final_rank ?? "—").padStart(2, "0")} {name}
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
                  {people.get(row.candidate_id)?.display_name ?? row.candidate_id} — {JSON.stringify(row.held_back_rules)}
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
              name={people.get(selected.candidate_id)?.display_name ?? selected.candidate_id}
              headline={people.get(selected.candidate_id)?.headline ?? ""}
              objections={objections}
              email={email}
              gates={data.ok ? data.gates : { reveal: false, send: false, ats: false }}
              proposedId={proposedId}
              onAcceptProposed={async () => {
                if (!proposedId) return;
                await acceptProposedIcp({ data: { icpId: proposedId } });
                setProposedId(null);
                toast.success("Proposed ICP accepted as a new version");
              }}
              onVote={async (vote, tags) => {
                const res = await voteCandidate({
                  data: { searchId: id, candidateId: selected.candidate_id, vote: { vote, tags } },
                });
                if (res.proposed) {
                  setProposedId(res.proposed.id);
                  toast.message("ICP change proposed from this vote. Accept it on this search — not on Rules.");
                }
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
                const sent = await doSend({
                  data: {
                    searchId: id,
                    candidateId: selected.candidate_id,
                    to: email,
                    subject: draft.subject,
                    body: draft.body,
                    facts: draft.personalizationFacts,
                  },
                });
                if (sent.ok) toast.success(`Sent via ${sent.via}`);
                else toast.error(sent.error ?? "Could not send");
              }}
              onAts={async () => {
                const res = await atsWrite({ data: { candidateId: selected.candidate_id } });
                if (res.ok) toast.success(`Created in ${res.toolkit}`);
                else toast.error(res.error);
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
  name,
  headline,
  gates,
  proposedId,
  onAcceptProposed,
  onVote,
  onReveal,
  onSend,
  onAts,
}: {
  searchId: string;
  row: ScoreRow;
  objections: { claim: string; objection: string }[];
  email: string | null;
  name: string;
  headline: string;
  gates: { reveal: boolean; send: boolean; ats: boolean };
  proposedId: string | null;
  onAcceptProposed: () => void;
  onVote: (vote: "up" | "down", tags: string[]) => void;
  onReveal: () => void;
  onSend: () => void;
  onAts: () => void;
}) {
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
        <h1 className="font-display text-3xl">{name}</h1>
        <p className="text-sm text-muted-foreground">{headline}</p>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          icp {row.icp_version_id.slice(-6)} · {row.model_version} · {row.prompt_version}
        </p>
        {row.model_version === "groq-fallback" ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Graded with Groq last-resort fallback — no LLM we can call.
          </p>
        ) : null}
      </div>
      {proposedId ? (
        <div className="rounded-xl border border-border bg-card p-3 text-sm">
          <p>A new ICP version was proposed from your vote. Rules is org-wide musts, not this diff.</p>
          <Button className="mt-2" size="sm" onClick={() => void onAcceptProposed()}>
            Accept proposed ICP
          </Button>
        </div>
      ) : null}
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
      <p className="text-sm text-muted-foreground">
        {email ? email : "Email not invented. Reveal stays closed until an inbox tool can actually run."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onVote("up", ["strong signal"])}>Keep</Button>
        <Button variant="outline" onClick={() => onVote("down", ["skills miss"])}>
          Pass
        </Button>
        <Button variant="secondary" disabled={!gates.reveal} onClick={() => void onReveal()}>
          Reveal contact
        </Button>
        <Button variant="outline" disabled={!gates.send || !email} onClick={() => void onSend()}>
          Send via inbox
        </Button>
        <Button variant="outline" disabled={!gates.ats} onClick={() => void onAts()}>
          Create in ATS
        </Button>
      </div>
      {!gates.reveal || !gates.send || !gates.ats ? (
        <p className="text-xs text-muted-foreground">
          Reveal, send, and ATS stay closed until those lanes can actually run.
        </p>
      ) : null}
    </div>
  );
}
