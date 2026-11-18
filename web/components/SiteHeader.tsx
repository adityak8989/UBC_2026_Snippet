"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useIsClient } from "@/lib/useIsClient";
import { FirstTimeGuide } from "./FirstTimeGuide";
import { Logo } from "./Logo";

// `active` highlights the current page in the nav. (A prop rather than usePathname, which would
// make every page using the header dynamic under Cache Components.) `guide` shows the "New here?" pill
// (homepage and clip pages only); "auto" also opens it by itself on wide screens (homepage).
export function SiteHeader({
  active,
  guide = false,
}: { active?: "check" | "licenses"; guide?: boolean | "auto" } = {}) {
  const onCheck = active === "check";
  const onLicenses = active === "licenses";
  // The guide pill sits next to Connect Wallet until a wallet is connected (or it is dismissed).
  const isClient = useIsClient();
  // "disconnected" only: while wagmi reconnects a returning wallet, don't flash the guide open.
  const { status } = useAccount();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="Snippet home" className="rounded-lg">
            <Logo compact />
          </Link>
          <span className="hidden rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted sm:inline">
            Arc Testnet
          </span>
        </div>
        <nav className="flex shrink-0 items-center gap-3 whitespace-nowrap sm:gap-4">
          <Link
            href="/check"
            aria-current={onCheck ? "page" : undefined}
            className={`rounded-lg px-1 text-sm font-semibold transition-colors ${
              onCheck ? "text-primary-text" : "text-muted hover:text-ink"
            }`}
          >
            <span className="sm:hidden">Check</span>
            <span className="hidden sm:inline">Check License</span>
          </Link>
          <Link
            href="/licenses"
            aria-current={onLicenses ? "page" : undefined}
            className={`rounded-lg px-1 text-sm font-semibold transition-colors ${
              onLicenses ? "text-primary-text" : "text-muted hover:text-ink"
            }`}
          >
            <span className="sm:hidden">Licenses</span>
            <span className="hidden sm:inline">My licenses</span>
          </Link>
          {guide && isClient && status === "disconnected" && <FirstTimeGuide autoOpen={guide === "auto"} />}
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
        </nav>
      </div>
    </header>
  );
}
