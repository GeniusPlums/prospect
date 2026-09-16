import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ClosedDossier, DeskStrip, OpenDossiers } from "@/components/desk";
import { IcpEditor } from "@/components/prospect/icp-editor";
import { FlowSteps } from "@/components/prospect/steps";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth/client";
import { parseBrief } from "@/lib/ai/parse-brief";
import { sampleBriefs } from "@/lib/data/sample-briefs";
import { searchReadiness, startFromBrief } from "@/lib/server/fns";
import type { Icp } from "@/lib/types";

type Ready = Awaited<ReturnType<typeof searchReadiness>>;

function UnsignedLanding() {
  return (
    <AppShell
      folio
      action={
        <Link to="/sign-in" search={{ mode: "in" }} className="font-ui underline underline-offset-4">
          Sign in
        </Link>
      }
    >
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-end gap-10 px-4 pb-10 pt-12 sm:grid-cols-[1.1fr_0.9fr] sm:px-6 sm:pt-16">
        <div>
          <p className="font-ui text-sm text-muted-foreground">A hiring harness · not a database</p>
          <h1 className="mt-4 max-w-xl font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Fewer people.
            <br />
            A case for each.
          </h1>
          <p className="mt-6 max-w-md font-sans text-lg leading-snug text-foreground/85">
            You bring a people source, an inbox, an ATS, and a model. Prospect reads the brief, grades
            against an ICP, and stops when no one passes. Search stays locked until a people source can
            actually run.
          </p>
          <ol className="mt-8 max-w-md space-y-2 border-t border-border pt-6 font-ui text-sm">
            <li>01 — Connect tools first. Empty catalog is allowed.</li>
            <li>02 — Cache before collect. Spend is visible.</li>
            <li>03 — Reveal and send only if those lanes run. No invented email.</li>
          </ol>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link to="/sign-in" search={{ mode: "up" }}>
                Create workspace
              </Link>
            </Button>
            <Link to="/sign-in" search={{ mode: "in" }} className="font-ui text-sm underline underline-offset-4">
              I already have a desk
            </Link>
          </div>
        </div>
        <div className="hidden sm:block">
          <OpenDossiers />
        </div>
      </main>
      <footer className="mt-auto bg-blotter">
        <DeskStrip />
      </footer>
    </AppShell>
  );
}

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
        if ("error" in result && /people source|No sourcing|no runnable sourcing/i.test(String(result.error))) {
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

  const { data: session } = authClient.useSession();
  const reviewing = Boolean(icp);

  if (!session?.user) {
    return <UnsignedLanding />;
  }

  if (!hydrated || !ready) {
    return (
      <AppShell>
        <main className="mx-auto max-w-xl px-4 py-24 font-ui text-sm text-muted-foreground">
          Opening the desk…
        </main>
      </AppShell>
    );
  }

  if (!ready.ok) {
    return <UnsignedLanding />;
  }

  if (!ready.sourcingConnected) {
    return (
      <AppShell>
        <main className="mx-auto grid max-w-5xl items-start gap-10 px-4 py-12 sm:grid-cols-[1fr_0.8fr] sm:px-6">
          <div>
            <h1 className="font-display text-4xl">Source is closed</h1>
            <p className="mt-4 max-w-md font-sans text-lg leading-snug">
              {ready.sourcingError ||
                "Connect a people source before you can search. Role and ICP stay in the drawer until then."}
            </p>
            <Button asChild className="mt-8">
              <Link to="/connections">Open Connections</Link>
            </Button>
            <p className="mt-10 font-ui text-sm text-muted-foreground">Role / ICP — locked</p>
            <div className="mt-2 h-24 border border-dashed border-border bg-card/40" />
          </div>
          <ClosedDossier className="justify-self-center opacity-90" />
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
              className="min-h-11 font-ui text-xs underline underline-offset-4"
            >
              Change role
            </Link>
          </div>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-36 sm:px-6">
            <div className="mb-4 flex flex-wrap items-baseline gap-3">
              <h1 className="font-display text-3xl">{icp.title}</h1>
              <span className="font-ui text-sm text-muted-foreground">
                {ready.sourcingToolkit ?? "Sourcing"} signed in
              </span>
            </div>
            {groqNote || !ready.llmConnected ? (
              <p className="mb-4 font-ui text-sm text-muted-foreground">
                Groq is last-resort fallback only — no LLM we can call. Connect one on{" "}
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
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
          <p className="font-ui text-sm text-muted-foreground">
            {ready.sourcingToolkit ?? "Sourcing"} can search · cache first · empty allowed
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl">
            {icp?.title ?? "Paste a role"}
          </h1>
          {!ready.llmConnected ? (
            <p className="mt-3 font-ui text-sm text-muted-foreground">
              No LLM we can call — briefs may use Groq as last-resort fallback.
            </p>
          ) : null}
          <div className="mt-6">
            <FlowSteps current={1} />
          </div>
          <section className="mt-12 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="font-display text-2xl">Gazette roles</h2>
              <ol className="mt-4 divide-y divide-border border-y border-border">
                {sampleBriefs.map((item, i) => (
                  <li key={item.id}>
                    <Link
                      to="/"
                      search={{ sample: item.id }}
                      className="flex gap-4 py-4 text-left hover:bg-secondary/60"
                    >
                      <span className="w-8 font-mono text-xs text-stamp">{String(i + 1).padStart(2, "0")}</span>
                      <span>
                        <span className="block font-display text-lg leading-tight">{item.label}</span>
                        <span className="mt-1 block font-ui text-sm text-muted-foreground">{item.blurb}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
            <section>
              <h2 className="font-display text-2xl">Or your own brief</h2>
              <div className="mt-4 border border-border bg-card p-3 sm:p-4">
                <Textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setIcp(null);
                    setSampleId(undefined);
                  }}
                  placeholder="Paste a job description."
                  className="min-h-48 border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
                <div className="flex justify-end border-t border-border pt-3">
                  <Button onClick={() => void onParse()} disabled={parsing || text.trim().length < 12}>
                    {parsing ? "Reading brief…" : "Read the brief"}
                  </Button>
                </div>
              </div>
            </section>
          </section>
        </main>
      )}
    </AppShell>
  );
}
