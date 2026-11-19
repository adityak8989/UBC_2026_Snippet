"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { friendlyTxError } from "@/lib/errors";
import { useIsClient } from "@/lib/useIsClient";
import { parseEventLogs, parseUnits } from "viem";
import { LicensedCount } from "@/components/LicensedCount";
import { PasskeyCheckout } from "@/components/PasskeyCheckout";
import { usePasskeySignedIn } from "@/lib/passkey";
import { PurchaseReceipt } from "@/components/PurchaseReceipt";
import { arcPaymentLine, formatUsd, formatUsdc } from "@/lib/money";
import { PreviewWatermark } from "@/components/PreviewWatermark";
import { SiteHeader } from "@/components/SiteHeader";
import { SyncedCaptions } from "@/components/SyncedCaptions";
import { CreatorBadge } from "@/components/CreatorBadge";
import { creatorPayoutLabel, getCreator } from "@/lib/creators";
import { contentTypeLabel, rightsSummary } from "@/lib/rights";
import { getSpokenTranscript } from "@/lib/captions";
import { getClipById } from "@/lib/clips";
import { USDC_ADDRESS, USDC_DECIMALS, SNIPPET_LICENSES_ADDRESS, ARC_TESTNET_CHAIN_ID } from "@/lib/arc";
import { SnippetLicensesAbi, ERC20Abi } from "@/lib/abi";

type UseType = "editorial" | "social" | "commercial";

const USE_TYPE_INDEX: Record<UseType, number> = {
  editorial: 0,
  social: 1,
  commercial: 2,
};

const USE_TYPE_LABEL: Record<UseType, string> = {
  editorial: "Editorial",
  social: "Social",
  commercial: "Commercial",
};

export default function ClipDetailPage() {
  return (
    <Suspense fallback={<ClipSkeleton />}>
      <ClipDetailContent />
    </Suspense>
  );
}

function ClipSkeleton() {
  return (
    <div className="flex min-h-screen flex-col" aria-label="Loading clip">
      <div className="h-16 border-b border-line" />
      <div className="mx-auto grid w-full max-w-6xl animate-pulse grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <div className="aspect-video rounded-2xl bg-surface" />
          <div className="h-4 w-1/3 rounded bg-surface" />
          <div className="h-8 w-3/4 rounded bg-surface" />
          <div className="h-4 w-full rounded bg-surface" />
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6 lg:col-span-5">
          <div className="h-6 w-1/2 rounded bg-surface-2" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-surface-2" />
          ))}
          <div className="h-12 rounded-xl bg-surface-2" />
        </div>
      </div>
    </div>
  );
}

function ClipDetailContent() {
  const params = useParams<{ id: string }>();
  const clip = getClipById(params.id);
  const transcript = clip ? getSpokenTranscript(clip.id) : undefined;
  const creator = getCreator(clip);

  // "Search what's said" links here with ?t=<start>&end=<end>: cue the video up just before the quote.
  const searchParams = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const jumpStart = searchParams.has("t") ? Number(searchParams.get("t")) : NaN;
  const jumpEnd = searchParams.has("end") ? Number(searchParams.get("end")) : jumpStart;
  const highlight = useMemo(
    () => (Number.isFinite(jumpStart) ? { start: jumpStart, end: Number.isFinite(jumpEnd) ? jumpEnd : jumpStart } : undefined),
    [jumpStart, jumpEnd],
  );
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !highlight) return;
    const cue = () => {
      video.currentTime = Math.max(0, highlight.start - 0.4);
    };
    if (video.readyState >= 1) cue();
    else video.addEventListener("loadedmetadata", cue, { once: true });
    return () => video.removeEventListener("loadedmetadata", cue);
  }, [highlight]);

  const [selectedTier, setSelectedTier] = useState<UseType>("social");

  // Wallet state only after hydration, so the first client render matches the server HTML.
  const { isConnected: walletConnected, address, chainId } = useAccount();
  const isClient = useIsClient();
  const isConnected = isClient && walletConnected;
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const wrongNetwork = isConnected && chainId !== ARC_TESTNET_CHAIN_ID;
  // Passkey signed in and no wallet: the passkey checkout below is the path, so the wallet box shrinks to
  // one line. (Its "Not enough funds" box and buy button only appear once a wallet connects.)
  const passkeySignedIn = usePasskeySignedIn();

  // Price calculations
  const priceUsd = clip ? clip.prices[selectedTier] : 0;
  const priceUnits = useMemo(() => {
    return parseUnits(priceUsd.toString(), USDC_DECIMALS);
  }, [priceUsd]);

  // Read buyer's USDC balance
  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address,
    },
  });

  const formattedBalance =
    usdcBalance !== undefined ? formatUsd(Number(usdcBalance) / 10 ** USDC_DECIMALS) : undefined;

  // Read USDC allowance
  const isContractReady =
    SNIPPET_LICENSES_ADDRESS &&
    SNIPPET_LICENSES_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20Abi,
    functionName: "allowance",
    args: address && isContractReady ? [address, SNIPPET_LICENSES_ADDRESS] : undefined,
    query: {
      enabled: isConnected && !!address && isContractReady,
    },
  });

  // Wagmi write hooks
  const {
    data: approveTxHash,
    writeContract: writeApprove,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  const {
    data: buyTxHash,
    writeContract: writeBuy,
    isPending: isBuyPending,
    error: buyError,
    reset: resetBuy,
  } = useWriteContract();

  // Transaction confirmations
  const {
    isLoading: isApproveConfirming,
    isSuccess: isApproveSuccess,
    error: approveReceiptError,
  } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  // Poll every 250 ms (wagmi's default is 4 s) so "Settled on Arc in X.XXs" is accurate to ~0.25 s.
  const {
    data: buyReceipt,
    dataUpdatedAt: buyReceiptAt,
    isLoading: isBuyConfirming,
    isSuccess: isBuySuccess,
    error: buyReceiptError,
  } = useWaitForTransactionReceipt({
    hash: buyTxHash,
    pollingInterval: 250,
  });

  // When the wallet handed back the buy transaction hash, i.e. the user confirmed it.
  const [buySentAt, setBuySentAt] = useState<number | null>(null);
  const settledSeconds =
    isBuySuccess && buySentAt !== null ? Math.max(0, buyReceiptAt - buySentAt) / 1000 : undefined;

  // The license this purchase created, as recorded on-chain.
  const issued = useMemo(() => {
    if (!buyReceipt) return undefined;
    return parseEventLogs({ abi: SnippetLicensesAbi, logs: buyReceipt.logs, eventName: "LicenseIssued" })[0]
      ?.args;
  }, [buyReceipt]);

  // Use types bought on this page this session; their preview loses the watermark (Aditya's idea).
  const [licensedUseTypes, setLicensedUseTypes] = useState<Set<number>>(() => new Set());
  const selectedUseType = USE_TYPE_INDEX[selectedTier];
  const tierLicensed =
    licensedUseTypes.has(selectedUseType) || (isBuySuccess && issued?.useType === selectedUseType);

  // Amount this page last asked the wallet to approve. Once that approval confirms we trust it
  // right away, because the RPC can still return the old allowance for a moment afterwards.
  const [approvedUnits, setApprovedUnits] = useState<bigint | null>(null);
  const approvalConfirmed = isApproveSuccess && approvedUnits !== null && approvedUnits >= priceUnits;

  const needsApproval =
    isContractReady && !approvalConfirmed && (allowance === undefined || allowance < priceUnits);

  // Re-read the allowance after an approval (it went up) and after a purchase (it was spent),
  // and the balance after a purchase.
  useEffect(() => {
    if (isApproveSuccess || isBuySuccess) refetchAllowance();
    if (isBuySuccess) refetchBalance();
  }, [isApproveSuccess, isBuySuccess, refetchAllowance, refetchBalance]);

  // One-click buy: when "Buy license" needed an approval first, start buyLicense automatically
  // as soon as that approval confirms (wallet confirmation 2 of 2).
  const autoBuyAfterApproval = useRef(false);
  useEffect(() => {
    if (!autoBuyAfterApproval.current || !approvalConfirmed || !clip) return;
    autoBuyAfterApproval.current = false;
    writeBuy(
      {
        address: SNIPPET_LICENSES_ADDRESS,
        abi: SnippetLicensesAbi,
        functionName: "buyLicense",
        args: [clip.clipIdBytes32, USE_TYPE_INDEX[selectedTier]],
        chainId: ARC_TESTNET_CHAIN_ID,
      },
      { onSuccess: () => setBuySentAt(Date.now()) },
    );
  }, [approvalConfirmed, clip, selectedTier, writeBuy]);

  const txError = approveError || approveReceiptError || buyError || buyReceiptError;
  const friendlyError = txError ? friendlyTxError(txError) : undefined;

  // Arc also takes the network fee in USDC, so the price alone must at least fit the balance.
  const notEnoughUsdc = usdcBalance !== undefined && usdcBalance < priceUnits && !isBuySuccess;

  if (!clip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <h1 className="mb-2 font-display text-2xl font-bold">Clip Not Found</h1>
        <p className="mb-6 text-muted">The clip you are looking for does not exist.</p>
        <Link
          href="/"
          className="rounded-xl bg-primary-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          ← Back to Marketplace
        </Link>
      </div>
    );
  }

  const rhAmount = (priceUsd * clip.split.rightsHolderBps) / 10000;
  const contribAmount = (priceUsd * clip.split.contributorBps) / 10000;
  const platformAmount = priceUsd - rhAmount - contribAmount;

  const handleApprove = () => {
    if (!isContractReady) return;
    setApprovedUnits(priceUnits);
    writeApprove(
      {
        address: USDC_ADDRESS,
        abi: ERC20Abi,
        functionName: "approve",
        args: [SNIPPET_LICENSES_ADDRESS, priceUnits],
        chainId: ARC_TESTNET_CHAIN_ID,
      },
      // Approval rejected or failed: don't fire the purchase later.
      { onError: () => (autoBuyAfterApproval.current = false) },
    );
  };

  const handleBuy = () => {
    if (!isContractReady) return;
    setBuySentAt(null);
    writeBuy(
      {
        address: SNIPPET_LICENSES_ADDRESS,
        abi: SnippetLicensesAbi,
        functionName: "buyLicense",
        args: [clip.clipIdBytes32, USE_TYPE_INDEX[selectedTier]],
        chainId: ARC_TESTNET_CHAIN_ID,
      },
      { onSuccess: () => setBuySentAt(Date.now()) },
    );
  };

  // The single "Buy license" button: approve first only if the allowance doesn't cover the price;
  // the effect above then sends buyLicense once the approval confirms.
  const handleBuyClick = () => {
    if (!isContractReady) return;
    if (needsApproval) {
      autoBuyAfterApproval.current = true;
      handleApprove();
    } else {
      handleBuy();
    }
  };

  // Progress text for the one button. Two wallet confirmations only when an approval was needed.
  const twoStep = !!approveTxHash;
  const awaitingAutoBuy = isApproveSuccess && !buyTxHash && !isBuyPending && !buyError;
  const busy = isApprovePending || isApproveConfirming || isBuyPending || isBuyConfirming || awaitingAutoBuy;
  const buyLabel = isApprovePending
    ? "Confirm 1 of 2 in your wallet"
    : isApproveConfirming
      ? "Approving the payment (1 of 2)…"
      : isBuyPending || awaitingAutoBuy
        ? twoStep
          ? "Confirm 2 of 2 in your wallet"
          : "Confirm in your wallet"
        : isBuyConfirming
          ? "Buying your license…"
          : `Buy license · ${formatUsdc(priceUsd)}`;

  // Back to a fresh "Buy license". The purchase spent the allowance, so read the fresh value before
  // clearing the old transactions; otherwise Buy could briefly show as ready.
  const handleBuyAnother = async () => {
    if (issued) setLicensedUseTypes((prev) => new Set(prev).add(issued.useType));
    await refetchAllowance();
    resetApprove();
    resetBuy();
    setApprovedUnits(null);
    setBuySentAt(null);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader guide />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          ← Back to Marketplace
        </Link>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Left Column: Video & Metadata */}
          <div className="flex flex-col gap-6 lg:col-span-7">
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-black">
              {/* Plays the light preview; the hashed master (clip.videoUrl) is only for download */}
              <video
                ref={videoRef}
                src={clip.previewUrl}
                poster={clip.posterUrl || undefined}
                controls
                playsInline
                preload="metadata"
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                className="h-full w-full object-contain"
              />
              {!tierLicensed && <PreviewWatermark detail="Purchase to unlock the master" />}
            </div>

            <SyncedCaptions transcript={transcript} videoRef={videoRef} highlight={highlight} />

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="font-medium text-primary-text">{clip.show}</span>
                <span>•</span>
                <span>{clip.duration}</span>
                <LicensedCount clipIdBytes32={clip.clipIdBytes32} className="font-medium text-success before:mr-2 before:text-muted before:content-['•']" />
                {clip.contributorName && !creator && (
                  <>
                    <span>•</span>
                    <span className="rounded bg-surface-2 px-2 py-0.5 font-medium">{clip.contributorName}</span>
                  </>
                )}
              </div>

              <h1 className="font-display text-2xl font-bold sm:text-3xl">{clip.title}</h1>
              {clip.quote && transcript && <p className="-mt-1 text-lg italic text-ink/80">“{clip.quote}”</p>}
              <p className="text-muted">{clip.description}</p>
              {creator && (
                <div className="mt-1">
                  <CreatorBadge creator={creator} withBio />
                </div>
              )}
            </div>
          </div>

          {/* Right Column: License Picker & Checkout */}
          <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 lg:col-span-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold">Select License Tier</h2>
                <p className="text-xs text-muted">Nonexclusive rights, recorded permanently on Arc.</p>
              </div>
              {isConnected && formattedBalance !== undefined && (
                <div className="shrink-0 rounded-lg border border-success/40 bg-success/10 px-2.5 py-1 text-right">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-success">
                    Balance
                  </span>
                  <span className="font-mono text-sm font-bold text-success">{formattedBalance}</span>
                </div>
              )}
            </div>

            {/* Tier Radio Options */}
            <div className="flex flex-col gap-3">
              {[
                {
                  key: "editorial" as UseType,
                  name: "Editorial Use",
                  price: clip.prices.editorial,
                  desc: "News, educational commentary, blog articles, noncommercial media.",
                },
                {
                  key: "social" as UseType,
                  name: "Social Media Use",
                  price: clip.prices.social,
                  desc: "YouTube Shorts, TikTok, Instagram Reels, X clips, podcasts.",
                },
                {
                  key: "commercial" as UseType,
                  name: "Commercial Use",
                  price: clip.prices.commercial,
                  desc: "Paid advertisements, brand sponsorship, broadcast TV, product promos.",
                },
              ].map((tier) => {
                // Price 0 = not for sale: the contract refuses it (PriceNotSet), so it can't be picked.
                const forSale = tier.price > 0;
                return (
                  <button
                    type="button"
                    key={tier.key}
                    onClick={() => setSelectedTier(tier.key)}
                    disabled={!forSale}
                    aria-pressed={selectedTier === tier.key}
                    className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition-all ${
                      !forSale
                        ? "cursor-not-allowed border-dashed border-line opacity-70"
                        : selectedTier === tier.key
                          ? "cursor-pointer border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "cursor-pointer border-line hover:border-muted/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{tier.name}</span>
                      {forSale ? (
                        <span className="font-display text-base font-bold text-primary-text">{formatUsdc(tier.price)}</span>
                      ) : (
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Not available</span>
                      )}
                    </div>
                    <p className="text-xs text-muted">{forSale ? tier.desc : (clip.priceNotes?.[tier.key] ?? "Not for sale.")}</p>
                  </button>
                );
              })}
            </div>

            {/* Rights: who owns what, and why a use may be unavailable */}
            <div className="flex flex-col gap-1.5 rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                <span>Rights</span>
                <span className="rounded bg-surface-2 px-2 py-0.5 text-muted">{contentTypeLabel(clip)}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted">{rightsSummary(clip)}</p>
            </div>

            {/* Split Breakdown Visualizer */}
            <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface-2 p-4">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Who gets paid</span>
                <span className="text-muted">All in one payment</span>
              </div>
              <div className="flex flex-col gap-1.5 text-xs text-muted">
                <div className="flex items-center justify-between">
                  <span>
                    {creator ? `Paid to ${creator.name}` : "Creator / Rights Holder"} ({clip.split.rightsHolderBps / 100}%):
                  </span>
                  <span className="font-medium text-ink">{formatUsd(rhAmount)}</span>
                </div>
                {clip.split.contributorBps > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Contributor ({clip.split.contributorBps / 100}%):</span>
                    <span className="font-medium text-ink">{formatUsd(contribAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Snippet Platform ({clip.split.platformBps / 100}%):</span>
                  <span className="font-medium text-ink">{formatUsd(platformAmount)}</span>
                </div>
              </div>
            </div>

            {/* Checkout Action Zone */}
            <div className="flex flex-col gap-3 border-t border-line pt-2">
              {clip.active === false ? (
                <div className="rounded-xl bg-surface-2 p-4 text-center text-sm text-muted">
                  This clip is no longer for sale. Licenses already sold for it stay valid.
                </div>
              ) : !isConnected && passkeySignedIn ? (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
                  <span className="text-xs text-muted">Buying with your passkey below. Prefer a browser wallet?</span>
                  <ConnectButton label="Connect" showBalance={false} />
                </div>
              ) : !isConnected ? (
                <div className="flex flex-col items-center gap-2 rounded-xl bg-surface-2 p-3">
                  <span className="text-xs text-muted">Connect your wallet to buy with free testnet USDC</span>
                  <ConnectButton />
                </div>
              ) : !isContractReady ? (
                <div className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/10 p-4 text-xs text-ink">
                  <p className="font-semibold">Contract Deployment Pending</p>
                  <p>
                    The UI and video catalog are fully ready. Deploying `SnippetLicenses` to Arc testnet (Step 4) will activate the onchain buy transactions.
                  </p>
                </div>
              ) : wrongNetwork ? (
                <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm" role="alert">
                  <p className="font-semibold">Your wallet is on another network.</p>
                  <p className="text-xs text-muted">Snippet runs on Arc Testnet. Switch networks to buy this license.</p>
                  <button
                    type="button"
                    onClick={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })}
                    disabled={isSwitching}
                    className="w-full cursor-pointer rounded-xl bg-primary-strong px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {isSwitching ? "Check your wallet..." : "Switch to Arc Testnet"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {notEnoughUsdc && (
                    <div className="flex flex-col gap-1 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm" role="alert">
                      <p className="font-semibold">Not enough funds for this license.</p>
                      <p className="text-xs text-muted">
                        You have {formattedBalance} USDC and this license costs {formatUsdc(priceUsd)}, plus a fee under 1¢.
                      </p>
                      <a
                        href="https://faucet.circle.com"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 w-fit text-xs font-semibold text-primary-text underline"
                      >
                        Get free testnet USDC at faucet.circle.com ↗
                      </a>
                    </div>
                  )}

                  {/* After a purchase: the receipt, then "Buy another license" instead of Buy */}
                  {isBuySuccess && buyTxHash ? (
                    <>
                      {issued && (
                        <PurchaseReceipt
                          licenseId={issued.licenseId}
                          priceUnits={issued.price}
                          useTypeLabel={Object.values(USE_TYPE_LABEL)[issued.useType] ?? ""}
                          payouts={[
                            { label: creatorPayoutLabel(clip), units: issued.rhAmount },
                            ...(issued.contribAmount > BigInt(0)
                              ? [{ label: "Contributor", units: issued.contribAmount }]
                              : []),
                            { label: "Snippet", units: issued.platformAmount },
                          ]}
                          txHash={buyTxHash}
                          settledSeconds={settledSeconds}
                          downloadUrl={clip.videoUrl}
                          downloadName={`${clip.id}-master.mp4`}
                        />
                      )}
                      <button
                        type="button"
                        onClick={handleBuyAnother}
                        className="w-full cursor-pointer rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-muted/60"
                      >
                        Buy another license
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={handleBuyClick}
                        disabled={notEnoughUsdc || busy}
                        aria-live="polite"
                        className="w-full cursor-pointer rounded-xl bg-primary-strong px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {buyLabel}
                      </button>
                      {!busy && (
                        <p className="text-center text-xs text-muted">
                          {needsApproval
                            ? "Two wallet confirmations: allow the payment, then buy."
                            : "One wallet confirmation."}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Transaction sent, waiting for the receipt */}
                  {buyTxHash && !isBuySuccess && (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 p-3 text-xs text-ink">
                      <span className="font-semibold">Payment sent, confirming on Arc…</span>
                      <a
                        href={`https://testnet.arcscan.app/tx/${buyTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-muted underline hover:text-ink"
                      >
                        Track it ↗
                      </a>
                    </div>
                  )}

                  {friendlyError && (
                    <div className="break-words rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm" role="alert">
                      <p className="font-semibold">{friendlyError.title}</p>
                      {friendlyError.detail && <p className="mt-1 text-xs text-muted">{friendlyError.detail}</p>}
                    </div>
                  )}
                </div>
              )}
              {clip.active !== false && (
                <p className="text-center text-xs font-medium text-ink/80">
                  {arcPaymentLine(isConnected && !!needsApproval)}
                </p>
              )}
            </div>

            {/* Second way to buy: a Circle passkey smart account, no browser wallet (lib/passkey.ts) */}
            <PasskeyCheckout
              clip={clip}
              useType={USE_TYPE_INDEX[selectedTier]}
              priceUsd={priceUsd}
              priceUnits={priceUnits}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
