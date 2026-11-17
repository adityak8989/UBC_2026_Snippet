"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { USDC_ADDRESS } from "@/lib/arc";

// Placeholder home page for the scaffold. The marketplace replaces this on Tuesday.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Snippet</h1>
        <ConnectButton />
      </div>
      <p className="text-zinc-600 dark:text-zinc-400">
        License 30-second podcast moments, paid in USDC on Arc testnet.
      </p>
      <p className="text-sm text-zinc-500">
        Testnet only. USDC (ERC-20, 6 decimals): <code>{USDC_ADDRESS}</code>
      </p>
    </main>
  );
}
