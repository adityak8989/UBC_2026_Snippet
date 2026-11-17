// "Preview" stamp over unlicensed playback (from Aditya's 9652262). Purely visual: the preview
// files are public, so this signals "unlicensed" rather than protecting the footage.
export function PreviewWatermark({ detail }: { detail?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center gap-1">
      <span className="-rotate-12 border-y border-dashed border-ink/25 px-5 py-1 font-display text-xs font-bold uppercase tracking-[0.25em] text-ink/30 sm:text-sm">
        Snippet Preview
      </span>
      {detail && <span className="-rotate-12 text-[10px] uppercase tracking-widest text-ink/30">{detail}</span>}
    </div>
  );
}
