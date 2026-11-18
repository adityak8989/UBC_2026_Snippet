"use client";

import { useState, useSyncExternalStore } from "react";
import { ARC_TESTNET_CHAIN_ID } from "@/lib/arc";

// "New here?": a small pill next to Connect Wallet that opens a three step guide. Shown only on the
// homepage and clip pages (SiteHeader `guide`), hidden once a wallet connects.
// - Homepage (`autoOpen`): the panel opens by itself on wide screens (>= 1280px, where it fits beside the
//   hero headline) until the visitor closes it; × collapses it to the pill for the rest of the session.
// - Clip pages and narrower screens: pill only, opens on click.
// - "Got it, don't show this again" hides it for good (localStorage).
// Storage is a per browser convenience; every access is wrapped because it can be blocked or throw.

const STORAGE_KEY = "snippet.firstTimeGuide.dismissed";
const SESSION_COLLAPSED_KEY = "snippet.firstTimeGuide.collapsed";
const AUTO_OPEN_MEDIA = "(min-width: 1280px)";

// Public values for wallet_addEthereumChain (EIP 3085). Arc uses USDC as gas: the native balance has
// 18 decimals (see lib/arc.ts).
const ARC_FOR_WALLETS = {
  chainId: `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`, // 0x4cef52
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

const listeners = new Set<() => void>();
let hiddenThisVisit = false;
function readDismissed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
function readCollapsedThisSession() {
  try {
    return window.sessionStorage.getItem(SESSION_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}
function rememberCollapsed() {
  try {
    window.sessionStorage.setItem(SESSION_COLLAPSED_KEY, "1");
  } catch {
    // storage blocked: it may auto open again on the next page load
  }
}
// Wide enough for the panel to sit beside the headline (checked at 1280, 1440 and 1536px).
function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(AUTO_OPEN_MEDIA);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function dismiss() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // storage blocked: the guide just goes away for this visit
  }
  hiddenThisVisit = true;
  listeners.forEach((l) => l());
}

type AddState = "idle" | "adding" | "added" | "no-wallet" | "error";

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export function FirstTimeGuide({ autoOpen = false }: { autoOpen?: boolean }) {
  // Server render and first paint: hidden, so nothing flashes for people who already dismissed it.
  const dismissed = useSyncExternalStore(
    subscribe,
    () => hiddenThisVisit || readDismissed(),
    () => true,
  );
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(AUTO_OPEN_MEDIA).matches,
    () => false,
  );
  // null = the visitor hasn't touched it yet on this page: follow the auto open rule.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const [collapsedThisSession] = useState(readCollapsedThisSession);
  const open = userOpen ?? (autoOpen && wide && !collapsedThisSession);
  const close = () => {
    setUserOpen(false);
    rememberCollapsed();
  };
  const [addState, setAddState] = useState<AddState>("idle");

  if (dismissed) return null;

  const addArc = async () => {
    const ethereum = (window as unknown as { ethereum?: Eip1193 }).ethereum;
    if (!ethereum) {
      setAddState("no-wallet");
      return;
    }
    setAddState("adding");
    try {
      await ethereum.request({ method: "wallet_addEthereumChain", params: [ARC_FOR_WALLETS] });
      setAddState("added");
    } catch {
      setAddState("error"); // rejected in the wallet, or the wallet refused
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? close() : setUserOpen(true))}
        aria-expanded={open}
        aria-controls="first-time-guide"
        aria-label="New here? Open the three step guide"
        className={`shrink-0 cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
          open ? "border-primary bg-primary/15 text-primary-text" : "border-line text-muted hover:border-muted/60 hover:text-ink"
        }`}
      >
        <span className="sm:hidden" aria-hidden="true">
          ?
        </span>
        <span className="hidden sm:inline">New here?</span>
      </button>

      {open && (
        <aside
          id="first-time-guide"
          aria-label="New here?"
          // Anchored to the sticky header (full viewport width), 16px from the right edge, so at 1280px and
          // up it sits to the right of the centered hero headline instead of over it.
          className="absolute right-4 top-full z-30 mt-2 w-[calc(100vw-2rem)] max-w-72 rounded-2xl border border-line bg-surface p-4 shadow-xl shadow-black/40"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-sm font-bold">New here? Three steps</p>
            <button
              type="button"
              onClick={close}
              aria-label="Close the guide"
              className="-mr-1 -mt-1 cursor-pointer rounded-md px-1.5 text-lg leading-none text-muted hover:text-ink"
            >
              ×
            </button>
          </div>
          <ol className="mt-3 flex flex-col gap-3 text-xs">
            <Step n={1}>
              <button
                type="button"
                onClick={addArc}
                disabled={addState === "adding" || addState === "added"}
                className="cursor-pointer rounded-lg bg-primary-strong px-2.5 py-1.5 font-semibold text-white hover:opacity-90 disabled:cursor-default disabled:opacity-70"
              >
                {addState === "adding" ? "Check your wallet…" : addState === "added" ? "Arc added ✓" : "Add Arc to your wallet"}
              </button>
              {addState === "no-wallet" && (
                <p className="mt-1 text-muted">
                  No browser wallet found. Install one such as{" "}
                  <a href="https://metamask.io" target="_blank" rel="noreferrer" className="text-primary-text underline">
                    MetaMask
                  </a>
                  , then try again.
                </p>
              )}
              {addState === "error" && <p className="mt-1 text-muted">Your wallet did not add Arc. Try again.</p>}
            </Step>
            <Step n={2}>
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary-text underline"
              >
                Get free testnet USDC ↗
              </a>
              <p className="mt-0.5 text-muted">Pick Arc Testnet and paste your wallet address.</p>
            </Step>
            <Step n={3}>
              <p className="font-semibold">Buy any clip</p>
              <p className="mt-0.5 text-muted">Choose a use, press Buy license, and you get a certificate.</p>
            </Step>
          </ol>
          <button
            type="button"
            onClick={dismiss}
            className="mt-3 cursor-pointer text-[11px] text-muted underline hover:text-ink"
          >
            Got it, don&apos;t show this again
          </button>
        </aside>
      )}
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[10px] text-muted">
        {n}
      </span>
      <div className="min-w-0">{children}</div>
    </li>
  );
}
