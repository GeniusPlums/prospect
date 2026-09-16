import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Mark } from "@/components/mark";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

const PRIMARY = [
  { to: "/", label: "Source" },
  { to: "/searches", label: "Searches" },
  { to: "/connections", label: "Connections" },
] as const;

const MORE = [
  { to: "/inbox", label: "Inbox" },
  { to: "/ats", label: "ATS" },
  { to: "/rules", label: "Rules" },
  { to: "/evals", label: "Evals" },
  { to: "/dashboard", label: "Precision" },
  { to: "/settings", label: "Settings" },
] as const;

export function FolioHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="rule-navy bg-background">
      <div className="mx-auto flex max-w-6xl items-end justify-between gap-4 px-4 py-5 sm:px-6">
        <Link to="/" className="flex items-end gap-3">
          <Mark className="mb-1 size-7" />
          <span className="font-display text-3xl leading-none tracking-tight">Prospect</span>
        </Link>
        <div className="flex items-center gap-4 font-ui text-sm">
          {action}
          <span className="hidden text-muted-foreground sm:inline">Bengaluru desk</span>
        </div>
      </div>
    </header>
  );
}

export function AppShell({
  children,
  wide = false,
  lock = false,
  crumb,
  action,
  folio = false,
}: {
  children: ReactNode;
  wide?: boolean;
  lock?: boolean;
  crumb?: string;
  action?: ReactNode;
  folio?: boolean;
}) {
  if (folio) {
    return (
      <div className={cn("flex min-h-dvh flex-col bg-background folio-paper text-foreground")}>
        <FolioHeader action={action} />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-background text-foreground",
        lock ? "h-dvh overflow-hidden" : "min-h-dvh",
      )}
    >
      <header className="sticky top-0 z-20 bg-background/95 rule-navy backdrop-blur-[2px]">
        <div
          className={cn(
            "flex h-14 items-center justify-between gap-4 px-4 sm:px-6",
            wide ? "max-w-none" : "mx-auto max-w-6xl",
          )}
        >
          <div className="flex min-w-0 items-baseline gap-3">
            <Link to="/" className="flex min-h-11 shrink-0 items-center gap-2">
              <Mark className="size-5" />
              <span className="font-display text-xl tracking-tight">Prospect</span>
            </Link>
            {crumb ? (
              <span className="hidden truncate font-ui text-sm text-muted-foreground sm:inline">
                {crumb}
              </span>
            ) : null}
          </div>
          <nav className="hidden items-baseline gap-5 font-ui text-sm md:flex">
            {PRIMARY.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-muted-foreground hover:text-foreground"
                activeProps={{ className: "text-foreground underline decoration-stamp underline-offset-8" }}
              >
                {item.label}
              </Link>
            ))}
            <details className="relative">
              <summary className="cursor-pointer list-none text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                More
              </summary>
              <div className="ledger absolute right-0 z-30 mt-2 min-w-40 py-2">
                {MORE.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="block px-3 py-1.5 text-sm text-foreground hover:bg-secondary"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>
          </nav>
          <div className="flex items-center gap-3 font-ui text-xs text-muted-foreground">
            {action}
            <SessionChip />
          </div>
        </div>
        <nav className="flex gap-4 overflow-x-auto border-t border-border px-4 py-2 font-ui text-xs md:hidden">
          {[...PRIMARY, ...MORE].map((item) => (
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

function SessionChip() {
  const { data, isPending } = authClient.useSession();
  if (isPending) return <span className="hidden font-ui sm:inline">…</span>;
  if (!data?.user) {
    return (
      <Link to="/sign-in" className="font-ui text-foreground underline underline-offset-4">
        Sign in
      </Link>
    );
  }
  return (
    <span className="flex items-center gap-2 font-ui">
      <span className="hidden max-w-40 truncate sm:inline">{data.user.email}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void authClient.signOut();
        }}
      >
        Sign out
      </Button>
    </span>
  );
}
