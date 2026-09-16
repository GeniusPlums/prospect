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
import { searchReadiness, startFromBrief } from "@/lib/server/fns";
import type { Icp } from "@/lib/types";

type Ready = Awaited<ReturnType<typeof searchReadiness>>;

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
  const [ready, setReady] = useState<Ready | null>(null);
  const [groqNote, setGroqNote] = useState(false);

  useEffect(() => {
    setHydrated(true);
    void searchReadiness().then(setReady);
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
      setGroqNote(false);
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
      setGroqNote(Boolean(result.groqFallback));
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
        if ("error" in result && result.error === "Sign in required") {
          await navigate({ to: "/sign-in" });
        }
        if ("error" in result && String(result.error).includes("Connect a sourcing")) {
          await navigate({ to: "/connections" });
        }
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

  if (!hydrated || !ready) {
    return (
      <AppShell>
        <main className="mx-auto max-w-xl px-4 py-24 text-sm text-muted-foreground">Loading…</main>
      </AppShell>
    );
  }

  if (!ready.ok) {
    return (
      <AppShell>
        <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            India-first sales · global product
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.1] tracking-tight sm:text-6xl">
            Prospect is a hiring harness
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground">
            You bring LLM, sourcing, ATS, and outreach. We do not sell a people database. Create a workspace —
            not a people dump. Search is not unlocked here.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {["Your tools", "Your spend", "Shortlists with reasons", "Empty is allowed"].map((label) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4 text-sm">
                {label}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/sign-in" search={{ mode: "up" }}>
                Create workspace
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/sign-in" search={{ mode: "in" }}>
                Sign in
              </Link>
            </Button>
          </div>
        </main>
      </AppShell>
    );
  }

  if (!ready.sourcingConnected) {
    return (
      <AppShell>
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <h1 className="font-display text-3xl">Source</h1>
          <div className="mt-6 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-medium">Sourcing not connected</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect a people toolkit before you can search. Role and ICP stay closed until then. There is no
              list, and we will not show the eval fixtures.
            </p>
            <Button asChild className="mt-5">
              <Link to="/connections">Go to Connections</Link>
            </Button>
          </div>
          <div className="pointer-events-none mt-8 opacity-40" aria-hidden>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Role / ICP</p>
            <div className="mt-3 h-20 rounded-xl border border-dashed border-border" />
          </div>
        </main>
      </AppShell>
    );
  }

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
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{icp.title}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                {ready.sourcingToolkit ?? "Sourcing"} connected
              </span>
            </div>
            {groqNote || !ready.llmConnected ? (
              <p className="mb-4 text-sm text-muted-foreground">
                Groq is last-resort fallback only — no LLM toolkit is connected. Connect one on{" "}
                <Link to="/connections" className="underline">
                  Connections
                </Link>{" "}
                to grade with your model.
              </p>
            ) : null}
            <IcpEditor icp={icp} onChange={setIcp} />
          </main>
          <div className="sticky bottom-0 z-40 border-t border-border bg-background/95">
            <div className="mx-auto flex max-w-6xl justify-end px-4 py-3 pr-32 pb-16 sm:px-6 sm:pb-3">
              <Button onClick={() => void onRun()} disabled={running} size="lg">
                {running ? "Starting search…" : "Find a shortlist"}
                <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">India-first sales · global product</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl">
            {icp?.title ?? "Role and ICP"}
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground">
            {ready.sourcingToolkit ?? "Sourcing"} is connected. Cache first, collect on miss, spend visible. Empty
            shortlists are allowed.
          </p>
          {!ready.llmConnected ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No LLM connected — briefs may use Groq as last-resort fallback.
            </p>
          ) : null}
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
                <Button onClick={() => void onParse()} disabled={parsing || text.trim().length < 12}>
                  {parsing ? "Reading brief…" : "Read the brief"}
                </Button>
              </div>
            </div>
          </section>
        </main>
      )}
    </AppShell>
  );
}
