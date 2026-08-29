import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Mark } from "@/components/mark";
import { QUOTAS, useHasHydrated, useProspectStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  wide = false,
  lock = false,
  crumb,
  action,
}: {
  children: ReactNode;
  wide?: boolean;
  lock?: boolean;
  crumb?: string;
  action?: ReactNode;
}) {
  const hydrated = useHasHydrated();
  const revealUsed = useProspectStore((s) => s.revealUsed);
  const contactsLeft = QUOTAS.reveals - (hydrated ? revealUsed : 0);

  return (
    <div
      className={cn(
        "flex flex-col bg-background text-foreground",
        lock ? "h-dvh overflow-hidden" : "min-h-dvh",
      )}
    >
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-sm">
        <div
          className={cn(
            "flex h-14 items-center justify-between gap-3 px-4 sm:px-6",
            wide ? "max-w-none" : "mx-auto max-w-6xl",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="flex min-h-11 shrink-0 items-center gap-2.5">
              <Mark className="size-5" />
              <span className="font-display text-lg tracking-tight">Prospect</span>
            </Link>
            {crumb ? (
              <>
                <span aria-hidden className="hidden text-border sm:inline">
                  /
                </span>
                <span className="hidden truncate text-sm text-muted-foreground sm:inline">
                  {crumb}
                </span>
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground sm:gap-4">
            {action}
            <span
              className="tabular-nums"
              title={`${hydrated ? revealUsed : 0} of ${QUOTAS.reveals} contacts shown this month`}
            >
              {contactsLeft} contacts left
            </span>
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
