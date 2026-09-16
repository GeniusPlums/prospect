import { cn } from "@/lib/utils";

/** Recruiter desk strip — the site's visual world, not a hero gimmick. */
export function DeskStrip({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 960 140"
      className={cn("w-full text-primary-foreground", className)}
      aria-hidden
    >
      <rect width="960" height="140" fill="#152238" />
      <path d="M0 18h960" stroke="#c9b89a" strokeWidth="1" opacity="0.35" />
      <g fill="#efe6d4">
        <rect x="48" y="40" width="70" height="88" />
        <rect x="56" y="48" width="54" height="4" fill="#152238" opacity="0.35" />
        <rect x="56" y="58" width="40" height="3" fill="#152238" opacity="0.25" />
        <rect x="140" y="52" width="78" height="76" />
        <rect x="148" y="60" width="62" height="4" fill="#152238" opacity="0.35" />
        <rect x="240" y="36" width="64" height="92" />
        <circle cx="292" cy="48" r="10" fill="#c23b22" />
        <rect x="328" y="58" width="90" height="70" />
        <rect x="336" y="68" width="74" height="3" fill="#152238" opacity="0.3" />
        <rect x="336" y="78" width="52" height="3" fill="#152238" opacity="0.2" />
        <rect x="440" y="44" width="56" height="84" />
        <rect x="516" y="50" width="82" height="78" />
        <rect x="524" y="60" width="66" height="3" fill="#152238" opacity="0.3" />
        <rect x="620" y="38" width="72" height="90" />
        <rect x="712" y="56" width="88" height="72" />
        <rect x="720" y="66" width="72" height="3" fill="#152238" opacity="0.3" />
        <rect x="824" y="42" width="68" height="86" />
        <circle cx="880" cy="54" r="9" fill="#c23b22" />
      </g>
    </svg>
  );
}

export function ClosedDossier({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 180" className={cn("w-full max-w-xs", className)} aria-hidden>
      <rect x="24" y="28" width="180" height="128" fill="#e4d7bf" stroke="#152238" strokeWidth="1.5" />
      <rect x="44" y="16" width="180" height="128" fill="#f7f0e2" stroke="#152238" strokeWidth="1.5" />
      <path d="M64 48h140M64 64h110M64 80h128" stroke="#152238" strokeWidth="1.2" opacity="0.35" />
      <circle cx="204" cy="36" r="14" fill="#c23b22" />
      <text x="204" y="40" textAnchor="middle" fill="#efe6d4" fontSize="9" fontFamily="Georgia, serif">
        wait
      </text>
    </svg>
  );
}

export function OpenDossiers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 280" className={cn("w-full", className)} aria-hidden>
      <rect x="28" y="48" width="200" height="200" fill="#e4d7bf" stroke="#152238" strokeWidth="1.5" />
      <rect x="52" y="28" width="220" height="210" fill="#f7f0e2" stroke="#152238" strokeWidth="1.5" />
      <rect x="76" y="12" width="220" height="220" fill="#efe6d4" stroke="#152238" strokeWidth="1.5" />
      <path d="M100 52h160M100 72h128M100 92h148M100 112h100" stroke="#152238" strokeWidth="1.3" opacity="0.4" />
      <circle cx="268" cy="36" r="16" fill="#c23b22" />
      <text x="268" y="41" textAnchor="middle" fill="#efe6d4" fontSize="10" fontFamily="Georgia, serif">
        case
      </text>
    </svg>
  );
}
