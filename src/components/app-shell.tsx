import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Mark } from "@/components/mark";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Source" },
  { to: "/searches", label: "Searches" },
  { to: "/rules", label: "Rules" },
  { to: "/inbox", label: "Inbox" },
  { to: "/ats", label: "ATS" },
  { to: "/evals", label: "Evals" },
  { to: "/dashboard", label: "Precision" },
  { to: "/settings", label: "Settings" },
] as const;

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
  return (
    <div
      className={cn(
        "flex flex-col bg-background text-foreground",
        lock ? "h-dvh overflow-hidden" : "min-h-dvh",
      )}
    >
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
        <div
          className={cn(
            "flex h-14 items-center justify-between gap-3 px-4 sm:px-6",
            wide ? "max-w-none" : "mx-auto max-w-6xl",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="flex min-h-11 shrink-0 items-center gap-2">
              <Mark className="size-5" />
              <span className="font-display text-lg tracking-tight">Prospect</span>
            </Link>
            {crumb ? (
              <span className="hidden truncate text-sm text-muted-foreground sm:inline">{crumb}</span>
            ) : null}
          </div>
          <nav className="hidden items-center gap-1 text-sm md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"
                activeProps={{ className: "rounded-md px-2 py-1 text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {action}
          </div>
        </div>
        <nav className="flex gap-3 overflow-x-auto border-t border-border px-4 py-2 text-xs md:hidden">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} className="shrink-0 text-muted-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
