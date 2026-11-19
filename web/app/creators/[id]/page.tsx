"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ClipCard } from "@/components/ClipCard";
import { SiteHeader } from "@/components/SiteHeader";
import { DEMO_CLIPS } from "@/lib/clips";
import { CREATORS } from "@/lib/creators";
import { formatUsdUnits } from "@/lib/money";
import { licensedTimesLabel, useSales } from "@/lib/useSales";

// Creator page, e.g. /creators/spacelofi: avatar, name, bio, the creator's active clips, and their numbers
// (earned, licenses sold, best seller) from QuickNode Streams' license_events, contract as fallback
// (lib/useSales.ts). "Earned" is the rights holder share of every license on the creator's clips,
// including clips that are no longer for sale.
//
// Note for later: a future "Submit a clip" form will live at /submit, not under /creator(s).

export default function CreatorPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-surface" />}>
          <CreatorContent />
        </Suspense>
      </main>
    </div>
  );
}

function CreatorContent() {
  const { id } = useParams<{ id: string }>();
  const creator = CREATORS[id];
  const allClips = useMemo(() => DEMO_CLIPS.filter((c) => c.creator === id), [id]);
  const activeClips = allClips.filter((c) => c.active !== false);
  const { data } = useSales();

  const stats = useMemo(() => {
    if (!data) return undefined;
    const ids = new Set(allClips.map((c) => c.clipIdBytes32.toLowerCase()));
    const sales = data.items.filter((s) => ids.has(s.clipId.toLowerCase()));
    const earned = sales.reduce((sum, s) => sum + s.rhAmount, BigInt(0));
    const counts = new Map<string, number>();
    for (const s of sales) counts.set(s.clipId.toLowerCase(), (counts.get(s.clipId.toLowerCase()) ?? 0) + 1);
    let best: { title: string; id: string; n: number } | undefined;
    for (const c of allClips) {
      const n = counts.get(c.clipIdBytes32.toLowerCase()) ?? 0;
      if (n > 0 && (!best || n > best.n)) best = { title: c.title, id: c.id, n };
    }
    return { earned, licenses: sales.length, best };
  }, [data, allClips]);

  if (!creator) {
    return (
      <div className="rounded-3xl border border-line bg-surface p-8 text-center">
        <h1 className="font-display text-xl font-bold">Creator not found</h1>
        <Link href="/" className="mt-4 inline-block text-sm text-primary-text underline">
          Browse clips
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link href="/" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        ← Back to Marketplace
      </Link>

      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
        {creator.avatar ? (
          // Pixel art avatar; a plain <img> keeps the SVG crisp.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creator.avatar}
            alt=""
            width={96}
            height={96}
            className="h-24 w-24 shrink-0 rounded-full border border-line bg-surface-2 [image-rendering:pixelated]"
          />
        ) : (
          <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/15 font-display text-2xl font-bold text-primary-text">
            {creator.initials}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Creator</p>
          <h1 className="font-display text-3xl font-bold">{creator.name}</h1>
          <p className="mt-1 text-muted">{creator.bio}</p>
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label={`Earned by ${creator.name}`} value={stats ? formatUsdUnits(stats.earned) : undefined} />
        <Stat label="Licenses sold" value={stats ? stats.licenses.toString() : undefined} />
        <Stat
          label="Best seller"
          value={stats ? (stats.best ? stats.best.title : "No sales yet") : undefined}
          note={stats?.best ? licensedTimesLabel(stats.best.n) : undefined}
          href={stats?.best ? `/clips/${stats.best.id}` : undefined}
        />
      </dl>
      {data && (
        <p className="-mt-5 text-xs text-muted">
          {data.source === "streams" ? "Live via QuickNode Streams" : "Read from Arc"} · settled in USDC on Arc
        </p>
      )}

      <section aria-labelledby="creator-clips" className="flex flex-col gap-4">
        <h2 id="creator-clips" className="font-display text-xl font-bold">
          Clips by {creator.name}
        </h2>
        {activeClips.length === 0 ? (
          <p className="text-sm text-muted">No clips for sale right now.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activeClips.map((clip) => (
              <ClipCard key={clip.id} clip={clip} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, note, href }: { label: string; value?: string; note?: string; href?: string }) {
  const body =
    value === undefined ? (
      <span className="mt-1 inline-block h-7 w-20 animate-pulse rounded bg-line" />
    ) : (
      <span className="block truncate font-display text-2xl font-bold">{value}</span>
    );
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface px-4 py-3">
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="min-w-0">
        {href ? (
          <Link href={href} className="hover:text-primary-text">
            {body}
          </Link>
        ) : (
          body
        )}
        {note && <span className="text-xs text-success">{note}</span>}
      </dd>
    </div>
  );
}
