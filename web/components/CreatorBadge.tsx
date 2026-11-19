import Link from "next/link";
import type { Creator } from "@/lib/creators";

/**
 * Round avatar (pixel art stays crisp) + creator name. Falls back to initials when the creator has no avatar.
 * `withBio` is the clip page version: 36px avatar, a "Creator" label and the one-line bio; otherwise 24px.
 */
export function CreatorBadge({ creator, withBio = false, href }: { creator: Creator; withBio?: boolean; href?: string }) {
  const badge = <BadgeContent creator={creator} withBio={withBio} />;
  // With href (cards, clip page): the whole badge links to the creator page.
  return href ? (
    <Link href={href} className="inline-flex min-w-0 rounded-lg transition-opacity hover:opacity-80" title={withBio ? undefined : creator.bio}>
      {badge}
    </Link>
  ) : (
    <span className="inline-flex min-w-0" title={withBio ? undefined : creator.bio}>
      {badge}
    </span>
  );
}

function BadgeContent({ creator, withBio }: { creator: Creator; withBio: boolean }) {
  const size = withBio ? "h-9 w-9" : "h-6 w-6";
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {creator.avatar ? (
        // A plain <img>: next/image would rasterize the SVG; it is tiny and already square.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={creator.avatar}
          alt=""
          width={withBio ? 36 : 24}
          height={withBio ? 36 : 24}
          className={`${size} shrink-0 rounded-full border border-line bg-surface-2 [image-rendering:pixelated]`}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`${size} flex shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/15 font-display font-bold text-primary-text ${
            withBio ? "text-xs" : "text-[10px]"
          }`}
        >
          {creator.initials}
        </span>
      )}
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="flex items-center gap-1.5">
          <span className={`truncate font-semibold text-ink ${withBio ? "text-sm" : "text-xs"}`}>{creator.name}</span>
          {withBio && (
            <span className="rounded border border-line px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-muted">
              Creator
            </span>
          )}
        </span>
        {withBio && <span className="truncate text-xs text-muted">{creator.bio}</span>}
      </span>
    </span>
  );
}
