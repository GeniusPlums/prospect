import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("text-foreground", className)}
      aria-hidden
    >
      <rect x="2" y="3" width="16" height="18" fill="currentColor" opacity="0.12" />
      <rect x="4" y="5" width="16" height="18" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 10h8M8 14h6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="18" cy="7" r="4" fill="#c23b22" />
    </svg>
  );
}
