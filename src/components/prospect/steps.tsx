import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, label: "Role" },
  { n: 2, label: "Who we want" },
  { n: 3, label: "Shortlist" },
] as const;

export function FlowSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Progress" className="flex items-baseline gap-3 font-ui text-sm">
      {STEPS.map((step, i) => {
        const state = step.n === current ? "current" : step.n < current ? "done" : "todo";
        return (
          <span key={step.n} className="flex items-baseline gap-3">
            {i > 0 ? <span className="text-border">/</span> : null}
            <span
              className={cn(
                state === "current" && "text-foreground underline decoration-stamp underline-offset-4",
                state === "done" && "text-muted-foreground",
                state === "todo" && "text-muted-foreground/45",
              )}
            >
              <span className="mr-1 font-mono text-[10px] text-stamp">{String(step.n).padStart(2, "0")}</span>
              {step.label}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
