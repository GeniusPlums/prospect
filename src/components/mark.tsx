import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("text-foreground", className)}
      aria-hidden
    >
      <rect x="5" y="8" width="5" height="12" rx="1" fill="currentColor" />
      <rect
        x="13"
        y="3"
        width="5"
        height="17"
        rx="1"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  );
}
