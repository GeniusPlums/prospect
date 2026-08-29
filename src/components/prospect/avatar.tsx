import { cn, hashString, initials } from "@/lib/utils";

export function PersonAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const h = hashString(name);
  const shift = (h % 12) - 6;
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm text-foreground",
        className,
      )}
      style={{ filter: `hue-rotate(${shift * 8}deg)` }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
