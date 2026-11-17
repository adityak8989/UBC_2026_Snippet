"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { DEMO_CLIPS } from "@/lib/clips";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:bg-blue-500 transition-colors">
                S
              </div>
              <span className="font-bold text-xl tracking-tight">Snippet</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-5 text-sm font-medium">
              <Link
                href="/"
                className="text-blue-600 dark:text-blue-400 font-semibold"
              >
                Marketplace
              </Link>
              <Link
                href="/check"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                License Checker
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-xs px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-900">
              Arc Testnet
            </span>
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-10 flex flex-col gap-10">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto flex flex-col gap-3">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            License Cinematic Moments On-Chain
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Pay in USDC on Arc testnet. Instant, non-custodial splits directly between creators and contributors in a single transaction with verifiable cryptographic clearance.
          </p>
        </div>

        {/* Clip Marketplace Grid */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="text-xl font-bold">Featured Video Clips</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Browse master footage cleared for editorial, social, or commercial use.
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
                  className="group rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
                >
                  {/* Video Player */}
                  <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                    <video
                      src={clip.videoUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
                    />
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[11px] font-medium px-2 py-0.5 rounded">
                      {clip.duration}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {clip.show}
                        </span>
                      </div>

                      <Link href={`/clips/${clip.id}`}>
                        <h3 className="font-bold text-lg leading-snug hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">
                          {clip.title}
                        </h3>
                      </Link>

                      <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                        {clip.description}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                      {/* Pricing Tier Summary */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">License tiers:</span>
                        <div className="flex gap-1.5 text-xs font-semibold">
                          <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            ${clip.prices.editorial}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            ${clip.prices.social}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            ${clip.prices.commercial}
                          </span>
                        </div>
                      </div>

                      {/* Split Breakdown */}
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                        <span>Splits:</span>
                        <span className="font-mono">
                          {rhPercent}% Creator · {contribPercent}% Contributor · {platformPercent}% Platform
                        </span>
                      </div>

                      {/* Buy Action Button */}
                      <Link
                        href={`/clips/${clip.id}`}
                        className="w-full mt-1 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-center text-sm transition-colors shadow-sm"
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

        {/* Minimalist Footer */}
        <footer className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Snippet</span>
            <span>·</span>
            <span>Built on Arc Testnet</span>
          </div>

          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Get Testnet USDC ↗
          </a>
        </footer>
      </main>
    </div>
  );
}
