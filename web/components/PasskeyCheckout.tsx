"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { PurchaseReceipt } from "@/components/PurchaseReceipt";
import { ERC20Abi } from "@/lib/abi";
import { ARC_TESTNET_CHAIN_ID, USDC_ADDRESS } from "@/lib/arc";
import type { Clip } from "@/lib/clips";
import { creatorPayoutLabel } from "@/lib/creators";
import { USE_TYPE_NAMES } from "@/lib/licenses";
import { formatUsdUnits, formatUsdc } from "@/lib/money";
import {
  NeedsFundingError,
  buyWithPasskey,
  forgetPasskey,
  getSmartAccountAddress,
  isUserCancel,
  loadPasskey,
  passkeyConfigured,
  passkeySignIn,
  type PasskeyPurchase,
  type StoredPasskey,
} from "@/lib/passkey";
import { useIsClient } from "@/lib/useIsClient";

// "Buy with passkey (no wallet needed)": the second way to buy on the clip page, next to the wallet flow.
// See lib/passkey.ts for how it works. Renders nothing when Circle isn't configured or the clip is delisted.

interface Props {
  clip: Clip;
  useType: number; // 0 Editorial, 1 Social, 2 Commercial
  priceUsd: number;
  priceUnits: bigint;
}

export function PasskeyCheckout(props: Props) {
  const isClient = useIsClient();
  if (!isClient || !passkeyConfigured || props.clip.active === false) return null;
  return <PasskeyCheckoutInner {...props} />;
}

type Busy = null | "register" | "login" | "confirm" | "buying";

// Circle's rule for passkey usernames: 5 to 50 characters, letters, numbers and _@.:+-
const USERNAME = /^[A-Za-z0-9_@.:+-]{5,50}$/;

function PasskeyCheckoutInner({ clip, useType, priceUsd, priceUnits }: Props) {
  // Mounted only on the client, so reading localStorage here can't break hydration.
  const [passkey, setPasskey] = useState<StoredPasskey | undefined>(loadPasskey);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string>();
  const [purchase, setPurchase] = useState<PasskeyPurchase>();
  const [copied, setCopied] = useState(false);

  const { data: address } = useQuery({
    queryKey: ["passkeyAddress", passkey?.id],
    queryFn: () => getSmartAccountAddress(passkey!),
    enabled: !!passkey,
    staleTime: Infinity,
  });
  const { data: balance, refetch: refetchBalance, isFetching: balanceLoading } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address },
  });
  const needsFunds = balance !== undefined && balance < priceUnits;

  const signIn = async (mode: "register" | "login") => {
    setError(undefined);
    setBusy(mode);
    try {
      setPasskey(await passkeySignIn(mode, name.trim()));
    } catch (err) {
      console.warn("Passkey sign in failed", err);
      setError(
        isUserCancel(err)
          ? "The passkey prompt was closed. Try again when you're ready."
          : mode === "login"
            ? "Could not sign in with a passkey. If you don't have one yet, create one."
            : "Could not create a passkey. Passkeys work on localhost in this demo; try again there.",
      );
    } finally {
      setBusy(null);
    }
  };

  const buy = async () => {
    if (!passkey) return;
    setError(undefined);
    setBusy("confirm");
    try {
      const result = await buyWithPasskey(passkey, clip.clipIdBytes32, useType, priceUnits, () => setBusy("buying"));
      setPurchase(result);
      refetchBalance();
    } catch (err) {
      console.warn("Passkey purchase failed", err);
      setError(
        err instanceof NeedsFundingError
          ? "Your passkey account needs more testnet USDC. Add some below, then try again."
          : isUserCancel(err)
            ? "The passkey confirmation was cancelled. Nothing was charged."
            : "The purchase didn't go through. Nothing was charged. Try again in a moment.",
      );
      refetchBalance();
    } finally {
      setBusy(null);
    }
  };

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked
    }
  };

  return (
    <section
      aria-labelledby="passkey-checkout"
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
    >
      <div>
        <h2 id="passkey-checkout" className="font-display text-base font-bold">
          Buy with passkey (no wallet needed)
        </h2>
        <p className="text-xs text-muted">
          Use Face ID, Touch ID or your device PIN. One confirmation pays in USDC on Arc; Circle covers the fee.
        </p>
      </div>

      {purchase ? (
        <>
          <PurchaseReceipt
            licenseId={purchase.licenseId}
            priceUnits={purchase.price}
            useTypeLabel={USE_TYPE_NAMES[purchase.useType] ?? ""}
            payouts={[
              { label: creatorPayoutLabel(clip), units: purchase.rhAmount },
              ...(purchase.contribAmount > BigInt(0) ? [{ label: "Contributor", units: purchase.contribAmount }] : []),
              { label: "Snippet", units: purchase.platformAmount },
            ]}
            txHash={purchase.txHash}
            settledSeconds={purchase.settledSeconds}
            downloadUrl={clip.videoUrl}
            downloadName={`${clip.id}-master.mp4`}
          />
          <p className="text-center text-xs text-muted">
            {purchase.sponsored ? "Network fee paid by Circle Gas Station." : "Network fee paid from your passkey account."}
          </p>
          <button
            type="button"
            onClick={() => setPurchase(undefined)}
            className="w-full cursor-pointer rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-semibold hover:border-muted/60"
          >
            Buy another license
          </button>
        </>
      ) : !passkey ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="passkey-name" className="text-xs font-semibold">
            Choose a username
          </label>
          <input
            id="passkey-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. alex_snippet"
            autoComplete="username webauthn"
            className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <p className="text-[11px] text-muted">5 to 50 letters or numbers, no spaces (_ @ . are fine).</p>
          <button
            type="button"
            onClick={() => signIn("register")}
            disabled={busy !== null || !USERNAME.test(name.trim())}
            className="w-full cursor-pointer rounded-xl bg-primary-strong px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "register" ? "Follow your device's prompt…" : "Create a passkey"}
          </button>
          <button
            type="button"
            onClick={() => signIn("login")}
            disabled={busy !== null}
            className="w-full cursor-pointer rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm font-semibold hover:border-muted/60 disabled:opacity-60"
          >
            {busy === "login" ? "Follow your device's prompt…" : "I already have a passkey"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs">
            <span className="min-w-0">
              <span className="text-muted">Passkey account </span>
              <span className="font-mono">{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "…"}</span>
            </span>
            <span className="font-mono font-semibold">
              {balance !== undefined ? `${formatUsdUnits(balance)} USDC` : balanceLoading ? "…" : ""}
            </span>
          </div>

          {needsFunds && address && (
            <div className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs" role="status">
              <p className="font-semibold">
                Add testnet USDC to your passkey account to pay {formatUsdc(priceUsd)}.
              </p>
              <code className="break-all rounded-lg bg-bg px-2 py-1.5 font-mono text-[11px]">{address}</code>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyAddress}
                  className="cursor-pointer rounded-lg border border-line bg-surface px-2.5 py-1.5 font-semibold hover:border-muted/60"
                >
                  {copied ? "Copied" : "Copy address"}
                </button>
                <a
                  href="https://faucet.circle.com"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-line bg-surface px-2.5 py-1.5 font-semibold text-primary-text hover:border-muted/60"
                >
                  Get free testnet USDC ↗
                </a>
                <button
                  type="button"
                  onClick={() => refetchBalance()}
                  className="cursor-pointer rounded-lg px-2.5 py-1.5 font-semibold text-muted underline hover:text-ink"
                >
                  {balanceLoading ? "Checking…" : "I added USDC"}
                </button>
              </div>
              <p className="text-muted">On the faucet, pick Arc Testnet and paste this address.</p>
            </div>
          )}

          <button
            type="button"
            onClick={buy}
            disabled={busy !== null || !address || needsFunds}
            className="w-full cursor-pointer rounded-xl bg-primary-strong px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "confirm"
              ? "Confirm with your passkey…"
              : busy === "buying"
                ? "Buying your license…"
                : `Buy with passkey · ${formatUsdc(priceUsd)}`}
          </button>
          <p className="text-center text-xs text-muted">One passkey confirmation: approve and buy in one step.</p>
          <button
            type="button"
            onClick={() => {
              forgetPasskey();
              setPasskey(undefined);
              setPurchase(undefined);
            }}
            className="mx-auto cursor-pointer text-[11px] text-muted underline hover:text-ink"
          >
            Use a different passkey
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
