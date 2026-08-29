import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Dossier } from "@/components/prospect/dossier";
import { PipelineRun } from "@/components/prospect/pipeline";
import { Shortlist } from "@/components/prospect/shortlist";
import { Button } from "@/components/ui/button";
import { gradeShortlist } from "@/lib/ai/grade-shortlist";
import { useHasHydrated, useProspectStore } from "@/lib/store";

export const Route = createFileRoute("/search/$id")({ component: SearchPage });

function nextUnreviewed(
  run: { results: { candidateId: string }[]; feedback: Record<string, { vote: string }> },
  currentId: string,
) {
  return run.results.find((r) => r.candidateId !== currentId && !run.feedback[r.candidateId])
    ?.candidateId;
}

function SearchPage() {
  const { id } = Route.useParams();
  const hydrated = useHasHydrated();
  const run = useProspectStore((s) => s.searches.find((r) => r.id === id));
  const completeSearch = useProspectStore((s) => s.completeSearch);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const gradedRef = useRef(false);

  const onPipelineDone = useCallback(() => {
    const current = useProspectStore.getState().searches.find((r) => r.id === id);
    completeSearch(id, current?.results ?? []);
  }, [completeSearch, id]);

  const onDecided = useCallback(() => {
    const current = useProspectStore.getState().searches.find((r) => r.id === id);
    if (!current || !selectedId) return;
    const next = nextUnreviewed(current, selectedId);
    if (next) setSelectedId(next);
  }, [id, selectedId]);

  useEffect(() => {
    if (!run || run.status !== "done" || run.sampleId || gradedRef.current) return;
    const top = run.results.slice(0, 8).map((r) => r.candidateId);
    gradedRef.current = true;
    let cancelled = false;
    void gradeShortlist({ data: { icp: run.icp, candidateIds: top } }).then((res) => {
      if (cancelled || !res.ok) return;
      const current = useProspectStore.getState().searches.find((r) => r.id === id);
      if (!current) return;
      const next = current.results.map((row) => {
        const g = res.grades[row.candidateId];
        return g ? { ...row, ...g } : row;
      });
      completeSearch(id, next);
    });
    return () => {
      cancelled = true;
    };
  }, [run, completeSearch, id]);

  useEffect(() => {
    if (run?.status === "done" && !selectedId && run.results[0] && typeof window !== "undefined") {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setSelectedId(run.results[0].candidateId);
      }
    }
  }, [run, selectedId]);

  useEffect(() => {
    if (!run || run.status !== "done") return;
    function onKey(e: KeyboardEvent) {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const current = useProspectStore.getState().searches.find((r) => r.id === id);
      if (!current) return;
      const idx = current.results.findIndex((r) => r.candidateId === selectedId);
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const n = current.results[idx + 1] ?? current.results[0];
        if (n) setSelectedId(n.candidateId);
      }
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const n = current.results[idx - 1] ?? current.results[current.results.length - 1];
        if (n) setSelectedId(n.candidateId);
      }
      if (e.key === "Escape" && selectedId && window.matchMedia("(max-width: 1023px)").matches) {
        setSelectedId(undefined);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, selectedId, id]);

  if (!hydrated) {
    return (
      <AppShell>
        <main className="px-6 py-24 text-sm text-muted-foreground">Loading search…</main>
      </AppShell>
    );
  }

  if (!run) {
    return (
      <AppShell>
        <main className="mx-auto max-w-xl px-6 py-24 text-center">
          <h1 className="font-display text-3xl">This search isn’t here</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Searches live in this browser. Start a new one from the home page.
          </p>
          <Link to="/" className="mt-6 inline-flex min-h-11 items-center text-sm underline">
            New search
          </Link>
        </main>
      </AppShell>
    );
  }

  if (run.status === "running") {
    return (
      <AppShell crumb={run.icp.title}>
        <PipelineRun onDone={onPipelineDone} />
      </AppShell>
    );
  }

  const selected = run.results.find((r) => r.candidateId === selectedId);
  const first = run.results[0];

  return (
    <AppShell
      wide
      lock
      crumb={run.icp.title}
      action={
        <Link to="/" className="min-h-9 text-xs text-muted-foreground hover:text-foreground">
          New search
        </Link>
      }
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={
            selectedId
              ? "hidden min-h-0 w-full flex-col overflow-hidden lg:flex lg:w-96 lg:shrink-0 lg:border-r lg:border-border"
              : "flex min-h-0 w-full flex-col overflow-hidden lg:w-96 lg:shrink-0 lg:border-r lg:border-border"
          }
        >
          <Shortlist run={run} selectedId={selectedId} onSelect={setSelectedId} />
        </aside>
        <section
          className={
            selectedId
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              : "hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex"
          }
        >
          {selected ? (
            <Dossier
              run={run}
              graded={selected}
              onBack={() => setSelectedId(undefined)}
              onDecided={onDecided}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
              <p className="max-w-sm text-sm text-muted-foreground">
                Start with the strongest match. Each person has a case for, a case against, and a
                reviewer.
              </p>
              {first ? (
                <Button onClick={() => setSelectedId(first.candidateId)}>
                  Open #{String(first.rank).padStart(2, "0")} first
                </Button>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
