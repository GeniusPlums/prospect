import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { IcpEditor } from "@/components/prospect/icp-editor";
import { FlowSteps } from "@/components/prospect/steps";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseBrief } from "@/lib/ai/parse-brief";
import { sampleBriefs } from "@/lib/data/sample-briefs";
import { startFromBrief } from "@/lib/server/fns";
import type { Icp } from "@/lib/types";

export function BriefHome() {
  const navigate = useNavigate();
  const { sample: sampleFromUrl } = useSearch({ from: "/" });
  const seeded = sampleBriefs.find((s) => s.id === sampleFromUrl);
  const [text, setText] = useState(seeded?.jd ?? "");
  const [icp, setIcp] = useState<Icp | null>(seeded?.icp ?? null);
  const [sampleId, setSampleId] = useState<string | undefined>(seeded?.id);
  const [parsing, setParsing] = useState(false);
  const [running, setRunning] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!sampleFromUrl) return;
    const next = sampleBriefs.find((s) => s.id === sampleFromUrl);
    if (!next) return;
    setText(next.jd);
    setIcp(next.icp);
    setSampleId(next.id);
  }, [sampleFromUrl]);

  async function onParse() {
    const sample = sampleBriefs.find((s) => s.jd.trim() === text.trim());
    if (sample) {
      setIcp(sample.icp);
      setSampleId(sample.id);
      await navigate({ to: "/", search: { sample: sample.id } });
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

  async function onRun() {
    if (!icp) return;
    setRunning(true);
    try {
      const result = await startFromBrief({ data: { text, sampleId, icp } });
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Could not start search");
        return;
      }
      await navigate({ to: "/search/$id", params: { id: result.searchId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setRunning(false);
    }
  }

  const reviewing = Boolean(icp);

  return (
    <AppShell>
      {reviewing && icp ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <FlowSteps current={2} />
            <Link
              to="/"
              search={{}}
              onClick={() => {
                setIcp(null);
                setSampleId(undefined);
              }}
              className="min-h-11 text-xs underline"
            >
              Change role
            </Link>
          </div>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-36 sm:px-6">
            <IcpEditor icp={icp} onChange={setIcp} />
          </main>
          <div className="sticky bottom-0 z-40 border-t border-border bg-background/95">
            <div className="mx-auto flex max-w-6xl justify-end px-4 py-3 pr-32 pb-16 sm:px-6 sm:pb-3">
              <Button onClick={() => void onRun()} disabled={!hydrated || running} size="lg">
                {!hydrated ? "Loading…" : running ? "Starting search…" : "Find 22 people"}
                <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">India-first sales · global product</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.1] tracking-tight sm:text-6xl">
            Fewer candidates.
            <br />
            A reason for each.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground">
            Ranked twenty with a case for, a case against, and contact only when you spend a reveal.
          </p>
          <div className="mt-6">
            <FlowSteps current={1} />
          </div>
          <section className="mt-12">
            <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Start with a role</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {sampleBriefs.map((item) => (
                <Link
                  key={item.id}
                  to="/"
                  search={{ sample: item.id }}
                  className="flex flex-col rounded-xl border border-border bg-card p-4 text-left"
                >
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.blurb}</p>
                </Link>
              ))}
            </div>
          </section>
          <section className="mt-12">
            <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Or paste your own</h2>
            <div className="mt-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
              <Textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setIcp(null);
                  setSampleId(undefined);
                }}
                placeholder="Paste a job description."
                className="min-h-40 border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <div className="flex justify-end">
                <Button onClick={() => void onParse()} disabled={!hydrated || parsing || text.trim().length < 12}>
                  {!hydrated ? "Loading…" : parsing ? "Reading brief…" : "Read the brief"}
                </Button>
              </div>
            </div>
          </section>
        </main>
      )}
    </AppShell>
  );
}
