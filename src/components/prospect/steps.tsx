import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, label: "Role" },
  { n: 2, label: "Who we want" },
  { n: 3, label: "Shortlist" },
] as const;

export function FlowSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Progress" className="flex items-center gap-2 text-xs sm:gap-3">
      {STEPS.map((step, i) => {
        const state =
          step.n === current ? "current" : step.n < current ? "done" : "todo";
        return (
          <span key={step.n} className="flex items-center gap-2 sm:gap-3">
            {i > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "h-px w-4 sm:w-8",
                  state === "todo" ? "bg-border" : "bg-foreground/40",
                )}
              />
            ) : null}
            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                state === "current" && "text-foreground",
                state === "done" && "text-muted-foreground",
                state === "todo" && "text-muted-foreground/45",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full font-mono text-[10px] tabular-nums",
                  state === "current" && "bg-primary text-primary-foreground",
                  state === "done" && "bg-secondary text-foreground",
                  state === "todo" && "bg-secondary text-muted-foreground",
                )}
              >
                {step.n}
              </span>
              <span className={cn(state !== "current" && "hidden sm:inline")}>{step.label}</span>
            </span>
          </span>
        );
      })}
    </nav>
  );
}
