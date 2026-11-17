"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { DEMO_CLIPS } from "@/lib/clips";
import { USDC_ADDRESS, SNIPPET_LICENSES_ADDRESS } from "@/lib/arc";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:bg-blue-500 transition-colors">
                S
              </div>
              <span className="font-bold text-xl tracking-tight">Snippet</span>
            </Link>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-900">
              Arc Testnet
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-10 flex flex-col gap-10">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto flex flex-col gap-3">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            License 30 Second Podcast Moments
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Pay in USDC on Arc testnet. Instant splits between the podcast host, interview guest, and platform in a single transaction, with no middleman holding funds.
          </p>
        </div>

        {/* Clip Marketplace Grid */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="text-xl font-bold">Featured Demo Clips</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Browse highlight clips cleared for editorial, social, or commercial use.
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              {DEMO_CLIPS.length} clips available
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEMO_CLIPS.map((clip) => {
              const rhPercent = clip.split.rightsHolderBps / 100;
              const contribPercent = clip.split.contributorBps / 100;
              const platformPercent = clip.split.platformBps / 100;

              return (
                <div
                  key={clip.id}
                  className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
                >
                  {/* Video Player */}
                  <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                    <video
                      src={clip.videoUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded font-mono pointer-events-none">
                      {clip.duration}
                    </div>
                  </div>

                  {/* Clip Details */}
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                        <span>{clip.show}</span>
                        <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                          {clip.contributorName}
                        </span>
                      </div>

                      <h3 className="font-semibold text-lg leading-snug">
                        {clip.title}
                      </h3>

                      <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                        {clip.description}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                      {/* Split Breakdown */}
                      <div className="text-xs text-zinc-500 flex items-center justify-between">
                        <span>Royalty Split:</span>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {contribPercent > 0
                            ? `${rhPercent}% Host · ${contribPercent}% Guest · ${platformPercent}% App`
                            : `${rhPercent}% Host · ${platformPercent}% App`}
                        </span>
                      </div>

                      {/* Pricing Pills */}
                      <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/60 p-2 rounded-xl text-xs">
                        <div className="text-center">
                          <div className="text-zinc-400">Editorial</div>
                          <div className="font-bold text-zinc-900 dark:text-zinc-100">
                            ${clip.prices.editorial}
                          </div>
                        </div>
                        <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />
                        <div className="text-center">
                          <div className="text-zinc-400">Social</div>
                          <div className="font-bold text-zinc-900 dark:text-zinc-100">
                            ${clip.prices.social}
                          </div>
                        </div>
                        <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />
                        <div className="text-center">
                          <div className="text-zinc-400">Commercial</div>
                          <div className="font-bold text-zinc-900 dark:text-zinc-100">
                            ${clip.prices.commercial}
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <Link
                        href={`/clips/${clip.id}`}
                        className="w-full text-center bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-4 rounded-xl shadow-sm transition-colors text-sm"
                      >
                        License This Clip →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Info Footer Callout */}
        <div className="rounded-2xl bg-zinc-100 dark:bg-zinc-900 p-6 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="font-medium text-zinc-700 dark:text-zinc-300">
              Arc Testnet Details
            </p>
            <p>
              Chain ID: <code className="font-mono">5042002</code> · USDC Token:{" "}
              <code className="font-mono">{USDC_ADDRESS}</code>
            </p>
            {SNIPPET_LICENSES_ADDRESS !== "0x0000000000000000000000000000000000000000" ? (
              <p>
                Contract: <code className="font-mono">{SNIPPET_LICENSES_ADDRESS}</code>
              </p>
            ) : (
              <p className="text-amber-600 dark:text-amber-400">
                Contract address not yet set in .env (waiting for Tuesday deploy)
              </p>
            )}
          </div>
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 font-medium"
          >
            Get Testnet USDC ↗
          </a>
        </div>
      </main>
    </div>
  );
}
