"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Logo } from "./Logo";

// `active` highlights the current page in the nav. (A prop rather than usePathname, which would
// make every page using the header dynamic under Cache Components.)
export function SiteHeader({ active }: { active?: "check" } = {}) {
  const onCheck = active === "check";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="Snippet home" className="rounded-lg">
            <Logo />
          </Link>
          <span className="hidden rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted sm:inline">
            Arc Testnet
          </span>
        </div>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/check"
            aria-current={onCheck ? "page" : undefined}
            className={`rounded-lg px-1 text-sm font-semibold transition-colors ${
              onCheck ? "text-primary" : "text-muted hover:text-ink"
            }`}
          >
            <span>Check License</span>
          </Link>
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
        </nav>
      </div>
    </header>
  );
}
