"use client";

import Link from "next/link";
import { CreatorBadge } from "@/components/CreatorBadge";
import { LicensedCount } from "@/components/LicensedCount";
import { PreviewWatermark } from "@/components/PreviewWatermark";
import type { Clip } from "@/lib/clips";
import { contributorShortName, getCreator } from "@/lib/creators";
import { formatUsdc } from "@/lib/money";
import { contentTypeLabel } from "@/lib/rights";

/** A clip as a card: preview, rights tag, creator (links to the creator page), title, quote, prices. */
export function ClipCard({ clip }: { clip: Clip }) {
  const rhPercent = clip.split.rightsHolderBps / 100;
  const contribPercent = clip.split.contributorBps / 100;
  const platformPercent = clip.split.platformBps / 100;
  const creator = getCreator(clip);

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-muted/50"
    >
      {/* Video Player */}
      <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-black">
        <video
          src={clip.previewUrl}
          poster={clip.posterUrl || undefined}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          onContextMenu={(e) => e.preventDefault()}
          className="h-full w-full object-contain"
        />
        <PreviewWatermark />
        <div className="pointer-events-none absolute left-2 top-2 rounded bg-bg/80 px-2 py-0.5 text-[11px] font-semibold text-ink backdrop-blur-sm">
          {contentTypeLabel(clip)}
        </div>
        <div className="pointer-events-none absolute right-2 top-2 rounded bg-bg/80 px-2 py-0.5 font-mono text-xs text-ink backdrop-blur-sm">
          {clip.duration}
        </div>
      </div>

      {/* Clip Details */}
      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted">
            <span className="text-primary-text">{clip.show}</span>
            {creator ? (
              <CreatorBadge creator={creator} href={`/creators/${creator.id}`} />
            ) : (
              clip.contributorName && (
                <span className="rounded bg-surface-2 px-2 py-0.5">{clip.contributorName}</span>
              )
            )}
          </div>

          <Link href={`/clips/${clip.id}`} className="w-fit">
            <h3 className="font-display text-lg font-semibold leading-snug transition-colors hover:text-primary-text">
              {clip.title}
            </h3>
          </Link>
          {clip.quote && <p className="-mt-1 text-sm italic text-ink/80">“{clip.quote}”</p>}

          <p className="line-clamp-2 text-sm text-muted">{clip.description}</p>
          <LicensedCount clipIdBytes32={clip.clipIdBytes32} className="text-xs font-medium text-success" />
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-3">
          {/* Split Breakdown */}
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Royalty Split:</span>
            <span className="font-medium text-ink">
              {contribPercent > 0
                ? `${rhPercent}% ${creator?.name ?? "Creator"} · ${contribPercent}% ${contributorShortName(clip)} · ${platformPercent}% Snippet`
                : `${rhPercent}% ${creator?.name ?? "Creator"} · ${platformPercent}% Snippet`}
            </span>
          </div>

          {/* Pricing Pills */}
          <div className="flex items-center justify-between rounded-xl bg-surface-2 p-2 text-xs">
            {(
              [
                ["Editorial", clip.prices.editorial],
                ["Social", clip.prices.social],
                ["Commercial", clip.prices.commercial],
              ] as const
            ).map(([label, price], i) => (
              <div key={label} className="flex flex-1 items-center">
                {i > 0 && <div className="h-6 w-px bg-line" />}
                <div className="flex-1 text-center">
                  <div className="text-muted">{label}</div>
                  {price > 0 ? (
                    <div className="font-bold text-ink">{formatUsdc(price)}</div>
                  ) : (
                    <div
                      className="inline-flex items-center justify-center gap-1 font-semibold text-muted"
                      title={clip.priceNotes?.[label.toLowerCase() as "commercial"] ?? "Not for sale"}
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3 fill-current">
                        <path d="M5 7V5a3 3 0 1 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-5A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z" />
                      </svg>
                      Not for sale
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Button */}
          <Link
            href={`/clips/${clip.id}`}
            className="w-full rounded-xl bg-primary-strong px-4 py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Select License & Buy →
          </Link>
        </div>
      </div>
    </div>
  );
}
