import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { IcpEditor } from "@/components/prospect/icp-editor";
import { FlowSteps } from "@/components/prospect/steps";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseBrief } from "@/lib/ai/parse-brief";
import { sampleBriefs } from "@/lib/data/sample-briefs";
import { runSearch } from "@/lib/ranking";
import { useHasHydrated, useProspectStore } from "@/lib/store";
import type { Icp } from "@/lib/types";

export function BriefHome() {
  const navigate = useNavigate();
  const createSearch = useProspectStore((s) => s.createSearch);
  const searches = useProspectStore((s) => s.searches);
  const hydrated = useHasHydrated();

  const [text, setText] = useState("");
  const [icp, setIcp] = useState<Icp | null>(null);
  const [sampleId, setSampleId] = useState<string | undefined>();
  const [parsing, setParsing] = useState(false);
  const [running, setRunning] = useState(false);

  async function onParse() {
    const sample = sampleBriefs.find((s) => s.jd.trim() === text.trim());
    if (sample) {
      setIcp(sample.icp);
      setSampleId(sample.id);
      return;
    }
    setParsing(true);
    try {
      const result = await parseBrief({ data: { text } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setIcp(result.icp);
      setSampleId(undefined);
    } catch {
      toast.error("Could not read that brief.");
    } finally {
      setParsing(false);
    }
  }

  function loadSample(id: string) {
    const sample = sampleBriefs.find((s) => s.id === id);
    if (!sample) return;
    setText(sample.jd);
    setIcp(sample.icp);
    setSampleId(sample.id);
  }

  function onRun() {
    if (!icp) return;
    setRunning(true);
    const results = runSearch(icp);
    const run = createSearch({
      briefText: text,
      icp,
      sampleId,
      results,
    });
    void navigate({ to: "/search/$id", params: { id: run.id } });
  }

  function clearBrief() {
    setText("");
    setIcp(null);
    setSampleId(undefined);
  }

  const sample = sampleBriefs.find((s) => s.id === sampleId);
  const reviewing = Boolean(icp);

  return (
    <AppShell>
      {reviewing && icp ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <FlowSteps current={2} />
            <button
              type="button"
              onClick={clearBrief}
              className="min-h-11 shrink-0 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Change role
            </button>
          </div>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-36 sm:px-6">
            {sample ? (
              <p className="mb-6 text-sm text-muted-foreground">
                Using <span className="text-foreground">{sample.label}</span>
              </p>
            ) : (
              <p className="mb-6 text-sm text-muted-foreground">Using your brief</p>
            )}
            <IcpEditor icp={icp} onChange={setIcp} />
          </main>
          <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur-sm">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
              <p className="hidden text-sm text-muted-foreground sm:block">
                Looks right? You’ll get a ranked twenty — not a pile of profiles.
              </p>
              <Button onClick={onRun} disabled={running} size="lg" className="w-full sm:w-auto">
                {running ? "Starting…" : "Find 22 people"}
                <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
          <div className="max-w-3xl">
            <p className="animate-fade-up text-xs uppercase tracking-[0.18em] text-muted-foreground">
              India-first sourcing
            </p>
            <h1 className="animate-fade-up stagger-2 mt-4 font-display text-4xl leading-[1.1] tracking-tight sm:text-6xl">
              Fewer candidates.
              <br />
              A reason for each.
            </h1>
            <p className="animate-fade-up stagger-4 mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Pick a role, confirm who you want, then review twenty people — each with a case for
              and against.
            </p>
            <div className="animate-fade-up stagger-5 mt-6">
              <FlowSteps current={1} />
            </div>
          </div>

          {hydrated && searches.length > 0 ? (
            <section className="animate-fade-up stagger-6 mt-12">
              <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Continue
              </h2>
              <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {searches.slice(0, 4).map((run) => {
                  const kept = Object.values(run.feedback).filter((f) => f.vote === "up").length;
                  const sent = Object.keys(run.sent ?? {}).length;
                  return (
                    <li key={run.id}>
                      <button
                        type="button"
                        className="flex w-full min-h-14 items-center justify-between gap-4 px-4 py-3 text-left hover:bg-accent/50"
                        onClick={() =>
                          void navigate({ to: "/search/$id", params: { id: run.id } })
                        }
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{run.icp.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {kept > 0 ? `${kept} kept` : `${run.results.length} people`}
                            {sent > 0 ? ` · ${sent} sent` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {new Date(run.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className="mt-12">
            <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Start with a role
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Demo roles with a ready brief. You’ll review the filters before anyone is ranked.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {sampleBriefs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={sampleId === item.id}
                  onClick={() => loadSample(item.id)}
                  className="group flex flex-col rounded-xl border border-border bg-card p-4 text-left transition-[box-shadow,background-color,border-color] duration-150 hover:shadow-[var(--shadow-border)]"
                >
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {item.blurb}
                  </p>
                  <p className="mt-4 inline-flex items-center gap-1 text-xs text-foreground/80">
                    Review who we want
                    <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Or paste your own
            </h2>
            <div className="mt-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
              <Textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setIcp(null);
                  setSampleId(undefined);
                }}
                placeholder="Paste a job description. We’ll turn it into must / nice / not a fit."
                className="min-h-40 border-0 bg-transparent px-3 py-3 font-sans text-base leading-relaxed shadow-none focus-visible:ring-0"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-1">
                <p className="text-xs text-muted-foreground">You edit the brief before it runs.</p>
                <Button onClick={() => void onParse()} disabled={parsing || text.trim().length < 12}>
                  {parsing ? "Reading brief…" : "Read the brief"}
                  {parsing ? null : <ArrowRight />}
                </Button>
              </div>
            </div>
          </section>
        </main>
      )}
    </AppShell>
  );
}
