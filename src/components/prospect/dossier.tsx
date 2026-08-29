import {
  Ban,
  Check,
  ChevronLeft,
  Copy,
  GitCommitHorizontal,
  Lock,
  Mail,
  Scale,
  ScanEye,
  Send,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/prospect/avatar";
import { OutreachComposer } from "@/components/prospect/outreach";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCandidate, currentRole } from "@/lib/data/candidates";
import { getCompany, snapshotAt } from "@/lib/data/companies";
import { FEEDBACK_TAGS, syntheticEmail } from "@/lib/ranking";
import { QUOTAS, useProspectStore } from "@/lib/store";
import type { GradedCandidate, SearchRun, Verdict } from "@/lib/types";
import { cn, formatLpa, formatNotice, yearRange } from "@/lib/utils";

const VERDICT_LABEL: Record<Verdict, string> = {
  strong: "Strong",
  mixed: "Mixed",
  weak: "Weak",
  flagged: "Flagged",
};

const PASS_TAGS = FEEDBACK_TAGS.filter((t) => t !== "strong signal");

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "for" | "against" | "unclear" | "reviewer";
  children: ReactNode;
}) {
  const bar =
    tone === "for"
      ? "border-for/60"
      : tone === "against"
        ? "border-against/60"
        : tone === "unclear"
          ? "border-unclear/60 border-dashed"
          : tone === "reviewer"
            ? "border-foreground/30"
            : "border-border";
  return (
    <section className={cn("border-l-2 pl-4", bar)}>
      <h3 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-pretty">{children}</div>
    </section>
  );
}

export function Dossier({
  run,
  graded,
  onBack,
  onDecided,
}: {
  run: SearchRun;
  graded: GradedCandidate;
  onBack?: () => void;
  onDecided?: () => void;
}) {
  const candidate = getCandidate(graded.candidateId);
  const reveal = useProspectStore((s) => s.reveal);
  const vote = useProspectStore((s) => s.vote);
  const revealUsed = useProspectStore((s) => s.revealUsed);
  const [tab, setTab] = useState("case");
  const [passOpen, setPassOpen] = useState(false);

  useEffect(() => {
    setTab("case");
    setPassOpen(false);
  }, [graded.candidateId]);

  if (!candidate) return null;

  const person = candidate;
  const role = currentRole(person);
  const company = getCompany(role.companyId);
  const snap = snapshotAt(role.companyId, role.start);
  const revealed = run.revealed.includes(person.id);
  const sent = run.sent?.[person.id];
  const fb = run.feedback[person.id];

  function onReveal() {
    const ok = reveal(run.id, person.id);
    if (!ok) {
      toast.error("No contacts left this month.");
      return;
    }
    setTab("email");
  }

  function onKeep() {
    vote(run.id, person.id, { vote: "up", tags: ["strong signal"] });
    onDecided?.();
  }

  function onPassTag(tag: string) {
    vote(run.id, person.id, { vote: "down", tags: [tag] });
    setPassOpen(false);
    onDecided?.();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <article className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-4 sm:px-6">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex min-h-9 items-center gap-1 text-xs text-muted-foreground lg:hidden"
          >
            <ChevronLeft className="size-3.5" />
            Shortlist
          </button>
        ) : null}
        <div className="flex items-start gap-4">
          <PersonAvatar name={candidate.name} className="size-12 text-base" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl tracking-tight">{candidate.name}</h2>
              <Badge variant={graded.verdict}>{VERDICT_LABEL[graded.verdict]}</Badge>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                #{String(graded.rank).padStart(2, "0")}
              </span>
              {sent ? <span className="text-xs text-for">Sent</span> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {role.title} · {company.name} · {candidate.city}
            </p>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{candidate.years} yrs</span>
              <span>Notice {formatNotice(candidate.noticePeriodDays)}</span>
              <span>Comp {formatLpa(candidate.expectedLpa)}</span>
              <span>{candidate.education.school}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={fb?.vote === "up" ? "default" : "outline"}
            onClick={onKeep}
          >
            {fb?.vote === "up" ? <Check /> : <ThumbsUp />}
            Keep
          </Button>
          <Button
            size="sm"
            variant={fb?.vote === "down" || passOpen ? "destructive" : "outline"}
            onClick={() => setPassOpen((v) => !v)}
          >
            <ThumbsDown />
            Pass
          </Button>
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          {revealed ? (
            <>
              <span className="inline-flex min-h-9 items-center gap-2 font-mono text-sm">
                <Mail className="size-4 text-for" />
                {syntheticEmail(person)}
              </span>
              <Button size="sm" variant="ghost" onClick={() => void copy(syntheticEmail(person))}>
                <Copy />
                Copy
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onReveal}>
              <Lock />
              Show contact
            </Button>
          )}
        </div>

        {passOpen ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <p className="w-full text-xs text-muted-foreground">Why are they a miss?</p>
            {PASS_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onPassTag(t)}
                className="min-h-9 rounded-full border border-border px-3 text-xs capitalize text-muted-foreground hover:border-primary/50 hover:text-foreground"
              >
                {t}
              </button>
            ))}
          </div>
        ) : null}

        <p className="mt-3 text-xs text-muted-foreground">
          {fb?.vote === "up"
            ? "Kept. Next unreviewed person is ready."
            : fb?.vote === "down"
              ? `Passed${fb.tags[0] ? ` · ${fb.tags[0]}` : ""}. The rest re-rank for free.`
              : revealed
                ? "Read the case, then write from the Email tab."
                : `Keep, pass with a reason, or show contact. ${QUOTAS.reveals - revealUsed} left this month.`}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList aria-label="Dossier sections">
          <TabsTrigger value="case">Case</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="email">
            Email
            {sent ? <span className="ml-1.5 text-[10px] text-for">Sent</span> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="case" className="flex-1 space-y-8 overflow-y-auto px-4 py-6 sm:px-6">
          {graded.disqualifiers.length > 0 ? (
            <Section title="Flags">
              <ul className="space-y-2">
                {graded.disqualifiers.map((d) => (
                  <li key={d.flag} className="flex gap-2">
                    <Ban className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    <span>
                      <span className="font-medium text-destructive">{d.flag}.</span> {d.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Why they ranked" tone="for">
            {graded.caseFor}
          </Section>
          <Section title="Why they might not" tone="against">
            {graded.caseAgainst}
          </Section>
          <Section title="Still unclear" tone="unclear">
            <ul className="space-y-1.5">
              {graded.unclear.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </Section>

          {graded.reviewerObjections.length > 0 ? (
            <Section title="Reviewer" tone="reviewer">
              <div className="space-y-3">
                {graded.reviewerObjections.map((o) => (
                  <div key={o.claim}>
                    <p className="flex gap-2 text-muted-foreground">
                      <ScanEye className="mt-0.5 size-3.5 shrink-0" />
                      <span>Claimed: {o.claim}</span>
                    </p>
                    <p className="mt-1 flex gap-2">
                      <Scale className="mt-0.5 size-3.5 shrink-0" />
                      <span>{o.objection}</span>
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </TabsContent>

        <TabsContent value="history" className="flex-1 space-y-8 overflow-y-auto px-4 py-6 sm:px-6">
          <ol className="space-y-4">
            {candidate.history.map((r) => {
              const co = getCompany(r.companyId);
              const s = snapshotAt(r.companyId, r.start);
              return (
                <li key={`${r.companyId}-${r.start}`} className="grid grid-cols-[88px_1fr] gap-4">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {yearRange(r.start, r.end)}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {r.title} · {co.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{r.scope}</p>
                    {s ? (
                      <p className="mt-2 text-xs leading-relaxed text-unclear">
                        In {r.start} this was {s.stage}, ~{s.headcount.toLocaleString("en-IN")} people.
                        {` ${s.signal}`}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
          {snap ? (
            <p className="text-xs text-muted-foreground">
              The signal is the {role.start} vintage at {company.name}, not the logo today.
            </p>
          ) : null}
          {candidate.github ? (
            <div>
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <GitCommitHorizontal className="size-3.5" />
                GitHub
              </p>
              <p className="mt-2 text-sm">
                @{candidate.github.handle} ·{" "}
                <span className="tabular-nums">
                  {candidate.github.contributions12m.toLocaleString("en-IN")}
                </span>{" "}
                contributions / 12 months · {candidate.github.languages.join(", ")}
              </p>
              {candidate.github.repos.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {candidate.github.repos.map((repo) => (
                    <li key={repo.name} className="text-sm">
                      <span className="font-mono text-xs">{repo.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {repo.stars} stars · {repo.description}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {candidate.talks.length + candidate.writing.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {candidate.talks.map((t) => (
                <li key={t.title}>
                  {t.year} · {t.venue} · {t.title}
                </li>
              ))}
              {candidate.writing.map((w) => (
                <li key={w.title} className="text-muted-foreground">
                  {w.year} · {w.title}
                </li>
              ))}
            </ul>
          ) : null}
        </TabsContent>

        <TabsContent value="email" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {revealed ? (
            <OutreachComposer run={run} candidate={person} revealed={revealed} />
          ) : (
            <div className="flex flex-1 flex-col items-start justify-start gap-3 px-6 py-10">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Contact is hidden
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Spend a reveal to see their email and get a note drafted from this dossier.
              </p>
              <Button onClick={onReveal}>
                <Send />
                Show contact and write
              </Button>
              <p className="text-xs text-muted-foreground">
                {QUOTAS.reveals - revealUsed} contacts left this month.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </article>
  );
}
