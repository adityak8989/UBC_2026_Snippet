"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { formatUnits } from "viem";
import { SiteHeader } from "@/components/SiteHeader";
import { ARC_TESTNET_CHAIN_ID, USDC_DECIMALS } from "@/lib/arc";
import { DEMO_CLIPS } from "@/lib/clips";
import { getCreator } from "@/lib/creators";
import { USE_TYPE_NAMES, fetchBuyerLicenses } from "@/lib/licenses";
import { useIsClient } from "@/lib/useIsClient";

// "My licenses": every license the connected wallet owns, newest first (license_events from QuickNode
// Streams, the contract as fallback). The wallet is the account, so there is nothing to log in to.
//
// DEMO NOTE: "Download master" links straight to the clip's original file in public/clips, which anyone
// can fetch. Masters are still public files in this demo. Future work: keep them in a private bucket and
// serve a short lived signed URL only after the wallet signs a message proving it owns a license
// (docs/PLAN.md section 5, "Download gate").

const usdc = (units: bigint) => Number(formatUnits(units, USDC_DECIMALS)).toFixed(2);

export default function MyLicensesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader active="licenses" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">My licenses</h1>
          <p className="mt-1 text-sm text-muted">Every license your wallet owns on Arc testnet.</p>
        </div>
        <LicenseList />
      </main>
    </div>
  );
}

function LicenseList() {
  // Wallet state only after hydration, so the first client render matches the server HTML.
  const isClient = useIsClient();
  const { address, isConnected } = useAccount();
  const client = usePublicClient({ chainId: ARC_TESTNET_CHAIN_ID });
  const connected = isClient && isConnected && !!address;

  const { data, isError, refetch } = useQuery({
    queryKey: ["myLicenses", address],
    queryFn: () => fetchBuyerLicenses(client!, address!),
    enabled: connected && !!client,
  });

  if (!connected) {
    return (
      <Panel>
        <p className="font-semibold">Connect your wallet to see your licenses</p>
        <p className="text-sm text-muted">Your wallet is your account: no sign up, no password.</p>
        <div className="mt-3 flex justify-center">
          <ConnectButton />
        </div>
      </Panel>
    );
  }
  if (isError && !data) {
    return (
      <Panel>
        <p className="font-semibold">Could not load your licenses</p>
        <button type="button" onClick={() => refetch()} className="cursor-pointer text-sm text-primary-text underline">
          Try again
        </button>
      </Panel>
    );
  }
  if (!data) {
    return (
      <ul className="flex flex-col gap-3" aria-label="Loading licenses">
        {Array.from({ length: 2 }).map((_, i) => (
          <li key={i} className="h-28 animate-pulse rounded-2xl border border-line bg-surface" />
        ))}
      </ul>
    );
  }
  if (data.licenses.length === 0) {
    return (
      <Panel>
        <p className="font-semibold">No licenses yet</p>
        <p className="text-sm text-muted">Licenses you buy with this wallet will show up here.</p>
        <Link
          href="/"
          className="mt-3 inline-block rounded-xl bg-primary-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Browse clips
        </Link>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        {data.licenses.length} {data.licenses.length === 1 ? "license" : "licenses"} ·{" "}
        {data.source === "streams" ? "indexed by QuickNode Streams" : "read from the contract"}
      </p>
      <ul className="flex flex-col gap-3">
        {data.licenses.map((l) => {
          const clip = DEMO_CLIPS.find((c) => c.clipIdBytes32.toLowerCase() === l.clipId.toLowerCase());
          const creator = getCreator(clip);
          // Offer the download only when the license names this exact master file.
          const master = clip && clip.fileHash.toLowerCase() === l.fileHash.toLowerCase() ? clip : undefined;
          const date = new Date(Number(l.timestamp) * 1000).toLocaleDateString("en-US", {
            dateStyle: "medium",
            timeZone: "UTC",
          });
          return (
            <li
              key={l.licenseId.toString()}
              className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 gap-4">
                <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-black sm:w-36">
                  {clip?.posterUrl && (
                    // Small static poster; next/image would add nothing here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={clip.posterUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-mono text-xs text-muted">License #{l.licenseId.toString()}</p>
                  <p className="truncate font-display font-semibold">{clip?.title ?? "Unknown clip"}</p>
                  {clip && (
                    <p className="truncate text-xs text-muted">{creator ? `by ${creator.name}` : clip.show}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="rounded-md bg-primary/15 px-2 py-0.5 font-semibold text-primary-text">
                      {USE_TYPE_NAMES[l.useType] ?? "Unknown"}
                    </span>
                    <span className="font-semibold">${usdc(l.price)} USDC</span>
                    <span className="text-muted">{date}</span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-2 sm:w-44 sm:flex-col">
                <Link
                  href={`/license/${l.licenseId.toString()}`}
                  className="flex-1 rounded-xl bg-primary-strong px-4 py-2 text-center text-sm font-semibold text-white hover:opacity-90"
                >
                  View certificate
                </Link>
                {master && (
                  <a
                    href={master.videoUrl}
                    download={`${master.id}-master.mp4`}
                    className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-2 text-center text-sm font-semibold hover:border-muted/60"
                  >
                    Download master
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface p-8 text-center">
      {children}
    </div>
  );
}
