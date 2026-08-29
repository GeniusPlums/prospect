import { Ban } from "lucide-react";
import { useMemo, useState } from "react";
import { PersonAvatar } from "@/components/prospect/avatar";
import { Badge } from "@/components/ui/badge";
import { getCandidate, currentRole } from "@/lib/data/candidates";
import { getCompany, snapshotAt } from "@/lib/data/companies";
import { useProspectStore } from "@/lib/store";
import type { GradedCandidate, SearchRun, Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

const VERDICT_LABEL: Record<Verdict, string> = {
  strong: "Strong",
  mixed: "Mixed",
  weak: "Weak",
  flagged: "Flagged",
};

type Filter = "all" | "open" | "strong" | "mixed" | "flagged" | "kept";

function firstLine(text: string, max = 88): string {
  const cut = text.split(/(?<=\.)\s/)[0] ?? text;
  return cut.length > max ? `${cut.slice(0, max - 1)}…` : cut;
}

function stats(run: SearchRun) {
  let kept = 0;
  let passed = 0;
  let sent = 0;
  for (const row of run.results) {
    const vote = run.feedback[row.candidateId]?.vote;
    if (vote === "up") kept += 1;
    if (vote === "down") passed += 1;
    if (run.sent?.[row.candidateId]) sent += 1;
  }
  return { kept, passed, sent, left: run.results.length - kept - passed };
}

export function Shortlist({
  run,
  selectedId,
  onSelect,
}: {
  run: SearchRun;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const s = stats(run);

  const rows = useMemo(() => {
    return run.results.filter((row) => {
      const vote = run.feedback[row.candidateId]?.vote;
      if (filter === "open") return !vote;
      if (filter === "kept") return vote === "up";
      if (filter === "strong") return row.verdict === "strong";
      if (filter === "mixed") return row.verdict === "mixed";
      if (filter === "flagged") return row.verdict === "flagged" || row.disqualifiers.length > 0;
      return true;
    });
  }, [run, filter]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: `All ${run.results.length}` },
    { id: "open", label: `To review ${s.left}` },
    { id: "strong", label: "Strong" },
    { id: "mixed", label: "Mixed" },
    { id: "flagged", label: "Flagged" },
    { id: "kept", label: s.kept ? `Kept ${s.kept}` : "Kept" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 overflow-hidden border-b border-border bg-background px-4 py-4 sm:px-5">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Shortlist</p>
        <h1 className="mt-1 font-display text-2xl tracking-tight">{run.icp.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {s.left === run.results.length
            ? `${run.results.length} people, strongest first. Open one to read why.`
            : `${s.kept} kept · ${s.passed} passed · ${s.left} left${s.sent ? ` · ${s.sent} sent` : ""}`}
        </p>
        <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "h-8 shrink-0 rounded-full px-3 text-xs transition-colors duration-150",
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {run.pendingIcpDiff ? <IcpDiffBanner run={run} /> : null}
      <ol className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <li className="px-5 py-10 text-sm text-muted-foreground">Nothing in this filter.</li>
        ) : (
          rows.map((row) => (
            <ShortlistRow
              key={row.candidateId}
              row={row}
              revealed={run.revealed.includes(row.candidateId)}
              sent={Boolean(run.sent?.[row.candidateId])}
              voted={run.feedback[row.candidateId]?.vote}
              active={selectedId === row.candidateId}
              onSelect={() => onSelect(row.candidateId)}
            />
          ))
        )}
      </ol>
      <p className="hidden border-t border-border px-5 py-2 text-xs text-muted-foreground lg:block">
        ↑↓ to move between people
      </p>
    </div>
  );
}

function IcpDiffBanner({ run }: { run: SearchRun }) {
  const applyIcpDiff = useProspectStore((s) => s.applyIcpDiff);
  const dismissIcpDiff = useProspectStore((s) => s.dismissIcpDiff);
  const diff = run.pendingIcpDiff;
  if (!diff) return null;
  const adds = [
    ...diff.addMust.map((m) => `+ must: ${m}`),
    ...diff.addDisqualifiers.map((d) => `+ not a fit: ${d}`),
  ];
  if (adds.length === 0) return null;
  return (
    <div className="border-b border-border bg-secondary/50 px-4 py-3 text-sm sm:px-5">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
        A pass changed the brief
      </p>
      <p className="mt-1 text-muted-foreground">{diff.note}</p>
      <ul className="mt-2 space-y-1 font-mono text-xs">
        {adds.map((line) => (
          <li key={line} className="text-for">
            {line}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="min-h-9 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
          onClick={() => applyIcpDiff(run.id)}
        >
          Apply and re-rank
        </button>
        <button
          type="button"
          className="min-h-9 rounded-md px-3 text-xs text-muted-foreground"
          onClick={() => dismissIcpDiff(run.id)}
        >
          Keep as-is
        </button>
      </div>
    </div>
  );
}

function ShortlistRow({
  row,
  revealed,
  sent,
  voted,
  active,
  onSelect,
}: {
  row: GradedCandidate;
  revealed: boolean;
  sent: boolean;
  voted?: "up" | "down";
  active: boolean;
  onSelect: () => void;
}) {
  const candidate = getCandidate(row.candidateId);
  if (!candidate) return null;
  const role = currentRole(candidate);
  const company = getCompany(role.companyId);
  const snap = snapshotAt(role.companyId, role.start);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex w-full items-start gap-3 border-b border-border px-4 py-3.5 text-left transition-colors duration-150 sm:px-5",
          active ? "border-l-2 border-l-primary bg-accent" : "border-l-2 border-l-transparent hover:bg-accent/50",
          voted === "down" && "opacity-50",
        )}
      >
        <span className="w-6 shrink-0 pt-1 font-mono text-xs tabular-nums text-muted-foreground">
          {String(row.rank).padStart(2, "0")}
        </span>
        <PersonAvatar name={candidate.name} className="mt-0.5 size-9" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{candidate.name}</span>
            <Badge variant={row.verdict}>{VERDICT_LABEL[row.verdict]}</Badge>
            {row.disqualifiers.length > 0 ? (
              <Ban className="size-3.5 text-destructive" />
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">
            {role.title} · {company.name}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-pretty text-muted-foreground">
            {firstLine(row.caseFor)}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground/80">
            <span>{candidate.city}</span>
            {snap ? <span>· {role.start} {snap.stage}</span> : null}
            {voted === "up" ? <span className="text-for">· Kept</span> : null}
            {voted === "down" ? <span>· Passed</span> : null}
            {revealed ? <span className="text-for">· Contact shown</span> : null}
            {sent ? <span className="text-for">· Sent</span> : null}
          </span>
        </span>
      </button>
    </li>
  );
}
