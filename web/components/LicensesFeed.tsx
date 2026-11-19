"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { DEMO_CLIPS, LISTED_CLIPS } from "@/lib/clips";
import { USE_TYPE_NAMES } from "@/lib/licenses";
import { formatUsdUnits } from "@/lib/money";
import { licensedTimesLabel, useSales } from "@/lib/useSales";

// Homepage "Recently licensed": a small stats row and the last 5 sales, one line each, live from QuickNode
// Streams (lib/useSales.ts). Each line links to that license's certificate.

const SHOWN = 5;

const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" }); // pinned: never the browser language
function timeAgo(date: Date, now: number): string {
  const s = Math.round((date.getTime() - now) / 1000);
  if (Math.abs(s) < 45) return "just now";
  const m = Math.round(s / 60);
  if (Math.abs(m) < 60) return rtf.format(m, "minute");
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return rtf.format(h, "hour");
  return rtf.format(Math.round(h / 24), "day");
}

// A clock for "time ago" that only reads the time in the browser (after hydration) and ticks every
// 15 s. Reading Date.now() during render breaks prerendering under Cache Components.
let clockNow = 0;
function subscribeClock(onTick: () => void) {
  clockNow = Date.now();
  onTick();
  const t = setInterval(() => {
    clockNow = Date.now();
    onTick();
  }, 15_000);
  return () => clearInterval(t);
}
function useNow() {
  return useSyncExternalStore(
    subscribeClock,
    () => clockNow,
    () => 0,
  );
}

export function LicensesFeed() {
  const now = useNow();
  const { data, isLoading, isError, refetch } = useSales();
  const items = data?.items ?? [];
  const totalToCreators = items.reduce((sum, i) => sum + i.rhAmount + i.contribAmount, BigInt(0));
  // Most licensed clip that is still for sale (ties: homepage order).
  const mostLicensed = (() => {
    const counts = new Map<string, number>();
    for (const i of items) counts.set(i.clipId.toLowerCase(), (counts.get(i.clipId.toLowerCase()) ?? 0) + 1);
    let best: { title: string; id: string; n: number } | undefined;
    for (const c of LISTED_CLIPS) {
      const n = counts.get(c.clipIdBytes32.toLowerCase()) ?? 0;
      if (n > 0 && (!best || n > best.n)) best = { title: c.title, id: c.id, n };
    }
    return best;
  })();
  const blockNote = data?.blockTime
    ? data.blockTime.basis === "licenses"
      ? "Average Arc block time, measured across indexed sales"
      : "Average Arc block time over the latest 1000 blocks"
    : undefined;

  return (
    <section aria-labelledby="recently-licensed" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="recently-licensed" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Recently licensed
        </h2>
        {data && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              data.source === "streams" ? "border-success/40 bg-success/10 text-success" : "border-line text-muted"
            }`}
          >
            {data.source === "streams" ? "Live via QuickNode Streams" : "Read from Arc"}
          </span>
        )}
      </div>

      {/* Stats: one small row */}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Paid to creators" value={data ? formatUsdUnits(totalToCreators) : undefined} />
        <Stat label="Licenses sold" value={data ? items.length.toString() : undefined} />
        <Stat
          label="Settles in about"
          value={data ? (data.blockTime ? `${data.blockTime.seconds.toFixed(1)}s` : "n/a") : undefined}
          title={blockNote}
        />
        <Stat
          label="Most licensed"
          value={data ? (mostLicensed ? mostLicensed.title : "None yet") : undefined}
          note={mostLicensed ? licensedTimesLabel(mostLicensed.n) : undefined}
          href={mostLicensed ? `/clips/${mostLicensed.id}` : undefined}
        />
      </dl>

      {/* Last sales, one line each */}
      {isLoading || !data ? (
        isError ? (
          <p className="text-sm text-muted">
            Recent sales are unavailable right now.{" "}
            <button type="button" onClick={() => refetch()} className="cursor-pointer text-primary-text underline">
              Try again
            </button>
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line" aria-label="Loading recent sales">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="h-10 animate-pulse bg-surface" />
            ))}
          </ul>
        )
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">No licenses sold yet. Be the first.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {items.slice(0, SHOWN).map((item) => {
            const clip = DEMO_CLIPS.find((c) => c.clipIdBytes32.toLowerCase() === item.clipId.toLowerCase());
            const fresh = now > 0 && now - item.time.getTime() < 60_000;
            return (
              <li key={item.licenseId.toString()}>
                <Link
                  href={`/license/${item.licenseId}`}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-surface-2 ${fresh ? "bg-success/5" : ""}`}
                >
                  <span className="shrink-0 font-mono text-xs text-muted">#{item.licenseId.toString()}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{clip?.title ?? "Unlisted clip"}</span>
                  <span className="hidden shrink-0 rounded-md bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary-text sm:inline">
                    {USE_TYPE_NAMES[item.useType] ?? "Unknown"}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-semibold">{formatUsdUnits(item.price)}</span>
                  <span className={`hidden w-24 shrink-0 text-right text-xs sm:inline ${fresh ? "font-semibold text-success" : "text-muted"}`}>
                    {now > 0 ? timeAgo(item.time, now) : ""}
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-primary-text">
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Stat({ label, value, title, note, href }: { label: string; value?: string; title?: string; note?: string; href?: string }) {
  const shown =
    value === undefined ? (
      <span className="inline-block h-5 w-12 animate-pulse rounded bg-line align-middle" />
    ) : (
      <span className="block truncate">{value}</span>
    );
  return (
    <div className="min-w-0 rounded-lg bg-surface px-3 py-2" title={title ?? (href ? value : undefined)}>
      <dt className="truncate text-[11px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="min-w-0 font-display text-base font-bold">
        {href ? (
          <Link href={href} className="hover:text-primary-text">
            {shown}
          </Link>
        ) : (
          shown
        )}
        {note && <span className="block font-sans text-[11px] font-medium text-success">{note}</span>}
      </dd>
    </div>
  );
}
