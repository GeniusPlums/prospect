import { useEffect, useRef, useState } from "react";
import { FlowSteps } from "@/components/prospect/steps";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  { t: 0, line: "Accepted the brief" },
  { t: 400, line: "Compiled search query · 11 clauses" },
  { t: 900, line: "People-data search · 3,142 IDs" },
  { t: 1400, line: "Cache check · 2,891 already on file" },
  { t: 2000, line: "Narrowed 3,142 → 300" },
  { t: 2600, line: "Resolved company snapshots" },
  { t: 3200, line: "Built dossiers from public work" },
  { t: 3900, line: "Wrote a case for and against each" },
  { t: 4600, line: "Flagged notice, visa, stuffing, comp" },
  { t: 5200, line: "Reviewer agent posted objections" },
  { t: 5800, line: "Ranked the top 50" },
  { t: 6400, line: "Shortlist of 22 is ready" },
];

export function PipelineRun({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(1);
  const finished = useRef(false);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }

  useEffect(() => {
    const timers = STEPS.map((step, i) =>
      window.setTimeout(() => setCount(i + 1), step.t),
    );
    const done = window.setTimeout(finish, 7000);
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(done);
    };
  }, [onDone]);

  const pct = Math.round((count / STEPS.length) * 100);

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
      <FlowSteps current={3} />
      <h1 className="mt-6 font-display text-3xl tracking-tight">Finding 22 people…</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Reading public work and writing a case for each. Contact stays hidden until you ask.
      </p>
      <div className="mt-8 h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="mt-8 space-y-2.5 font-mono text-sm">
        {STEPS.slice(0, count).map((step, i) => {
          const live = i === count - 1 && count < STEPS.length;
          return (
            <li
              key={step.line}
              className={cn(
                "animate-log-in flex gap-4 text-pretty",
                live ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="tabular-nums text-muted-foreground/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={live ? "animate-pulse" : undefined}>{step.line}</span>
            </li>
          );
        })}
      </ol>
      <Button variant="ghost" className="mt-10 self-start" onClick={finish}>
        Skip animation
      </Button>
    </div>
  );
}
