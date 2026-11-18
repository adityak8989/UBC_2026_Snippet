import type { Creator } from "@/lib/creators";

/** Initials avatar + creator name; `withBio` adds the one-line bio underneath (clip page). */
export function CreatorBadge({ creator, withBio = false }: { creator: Creator; withBio?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2" title={withBio ? undefined : creator.bio}>
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/15 font-display font-bold text-primary-text ${
          withBio ? "h-9 w-9 text-xs" : "h-6 w-6 text-[10px]"
        }`}
      >
        {creator.initials}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={`truncate font-semibold text-ink ${withBio ? "text-sm" : "text-xs"}`}>{creator.name}</span>
        {withBio && <span className="truncate text-xs text-muted">{creator.bio}</span>}
      </span>
    </span>
  );
}
