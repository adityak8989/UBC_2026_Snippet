// Snippet logo: a short audio waveform [ ▮▯▮ ] wrapped in square brackets, plus the wordmark.
// The same mark is in app/icon.svg (favicon) and public/logo.svg (standalone file).
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M9.5 7H6.5v18h3M22.5 7h3v18h-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="11" y="10.5" width="2.5" height="11" rx="1" className="fill-primary" />
      <rect
        x="15.25"
        y="8.5"
        width="1.5"
        height="15"
        rx="0.75"
        fill="none"
        className="stroke-primary"
        strokeWidth="1"
      />
      <rect x="18.5" y="12.5" width="2.5" height="7" rx="1" className="fill-primary" />
    </svg>
  );
}

/** `compact`: the wordmark only from the sm breakpoint up, so the header fits a phone. */
export function Logo({ compact = false }: { compact?: boolean } = {}) {
  return (
    <span className="flex items-center gap-1.5 text-ink">
      <LogoMark />
      <span className={`font-display text-xl font-bold tracking-tight ${compact ? "hidden sm:inline" : ""}`}>Snippet</span>
    </span>
  );
}
