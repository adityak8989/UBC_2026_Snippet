"use client";

import Link from "next/link";
import { LicensesFeed } from "@/components/LicensesFeed";
import { PreviewWatermark } from "@/components/PreviewWatermark";
import { SiteHeader } from "@/components/SiteHeader";
import { DEMO_CLIPS } from "@/lib/clips";
import { SNIPPET_LICENSES_ADDRESS } from "@/lib/arc";
import { EXPLORER_URL } from "@/lib/licenses";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10">
        {/* Hero */}
        <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            License the moment. Pay everyone in it.
          </h1>
          <p className="text-lg text-muted">
            Buy the rights to a 30 second clip in one checkout. The creator and everyone in the clip get paid the second you do.
          </p>
        </div>

        {/* Clip Marketplace Grid */}
        <section className="flex flex-col gap-6">
          <div className="flex items-end justify-between gap-4 border-b border-line pb-3">
            <div>
              <h2 className="font-display text-xl font-bold">Featured Video Clips</h2>
              <p className="text-sm text-muted">
                Browse master footage cleared for editorial, social, or commercial use.
              </p>
            </div>
            <span className="shrink-0 font-mono text-xs text-muted">
              {DEMO_CLIPS.length} clips available
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {DEMO_CLIPS.map((clip) => {
              const rhPercent = clip.split.rightsHolderBps / 100;
              const contribPercent = clip.split.contributorBps / 100;
              const platformPercent = clip.split.platformBps / 100;

              return (
                <div
                  key={clip.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-muted/50"
                >
                  {/* Video Player */}
                  <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-black">
                    <video
                      src={clip.previewUrl}
                      poster={clip.posterUrl}
                      controls
                      playsInline
                      preload="metadata"
                      controlsList="nodownload"
                      onContextMenu={(e) => e.preventDefault()}
                      className="h-full w-full object-contain"
                    />
                    <PreviewWatermark />
                    <div className="pointer-events-none absolute right-2 top-2 rounded bg-bg/80 px-2 py-0.5 font-mono text-xs text-ink backdrop-blur-sm">
                      {clip.duration}
                    </div>
                  </div>

                  {/* Clip Details */}
                  <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted">
                        <span className="text-primary-text">{clip.show}</span>
                        {clip.contributorName && (
                          <span className="rounded bg-surface-2 px-2 py-0.5">{clip.contributorName}</span>
                        )}
                      </div>

                      <Link href={`/clips/${clip.id}`} className="w-fit">
                        <h3 className="font-display text-lg font-semibold leading-snug transition-colors hover:text-primary-text">
                          {clip.title}
                        </h3>
                      </Link>

                      <p className="line-clamp-2 text-sm text-muted">{clip.description}</p>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-line pt-3">
                      {/* Split Breakdown */}
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>Royalty Split:</span>
                        <span className="font-medium text-ink">
                          {contribPercent > 0
                            ? `${rhPercent}% Creator · ${contribPercent}% Contributor · ${platformPercent}% Snippet`
                            : `${rhPercent}% Creator · ${platformPercent}% Snippet`}
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
                              <div className="font-bold text-ink">${price}</div>
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
            })}
          </div>
        </section>

        {/* Live feed of licenses sold, from QuickNode Streams */}
        <LicensesFeed />
      </main>

      <footer className="border-t border-line py-6 text-center text-sm">
        <a
          href={`${EXPLORER_URL}/address/${SNIPPET_LICENSES_ADDRESS}`}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-muted transition-colors hover:text-ink"
        >
          Verified on Arc ↗
        </a>
      </footer>
    </div>
  );
}
