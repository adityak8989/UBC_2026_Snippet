"use client";

import { LicensesFeed } from "@/components/LicensesFeed";
import { ClipCard } from "@/components/ClipCard";
import { QuoteSearch } from "@/components/QuoteSearch";
import { RightsExplainer } from "@/components/RightsExplainer";
import { REPO_URL } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { LISTED_CLIPS } from "@/lib/clips";
import { SNIPPET_LICENSES_ADDRESS } from "@/lib/arc";
import { EXPLORER_URL } from "@/lib/licenses";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader guide="auto" />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10">
        {/* Hero */}
        <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            License the moment. Pay everyone in it.
          </h1>
          <p className="text-lg text-muted">
            Buy the rights to short moments from streams and podcasts in one checkout. The creator and everyone in the clip get paid the second you do.
          </p>
        </div>

        {/* Find a quote across every clip's ElevenLabs transcript */}
        <QuoteSearch />

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
              {LISTED_CLIPS.length} clips available
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {LISTED_CLIPS.map((clip) => (
              <ClipCard key={clip.id} clip={clip} />
            ))}
          </div>
        </section>

        {/* What each content type allows */}
        <RightsExplainer />

        {/* Live feed of licenses sold, from QuickNode Streams */}
        <LicensesFeed />

        {/* What this site is, in plain words */}
        <section aria-labelledby="about" className="rounded-2xl border border-line bg-surface p-5 text-sm sm:p-6">
          <h2 id="about" className="font-display text-lg font-bold">
            About this demo
          </h2>
          <div className="mt-2 flex flex-col gap-2 text-muted">
            <p>
              Snippet is a student project built for the UBC 2026 hackathon. It runs only on Arc testnet and uses
              test dollars (testnet USDC), which have no real value; you can get some free at{" "}
              <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="text-primary-text underline">
                faucet.circle.com
              </a>
              .
            </p>
            <p>
              Buying a license asks your wallet for two things at most: permission to spend the exact license price,
              never an unlimited amount, and the purchase itself. The license and its payment split are recorded by
              our open source contract{" "}
              <a
                href={`${EXPLORER_URL}/address/${SNIPPET_LICENSES_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="break-all font-mono text-xs text-primary-text underline"
              >
                {SNIPPET_LICENSES_ADDRESS}
              </a>
              , whose source code is published on the Arc testnet explorer and in our{" "}
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-primary-text underline">
                GitHub repository
              </a>
              .
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
