"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEventLogs, parseUnits } from "viem";
import { PurchaseReceipt } from "@/components/PurchaseReceipt";
import { SiteHeader } from "@/components/SiteHeader";
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
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-8 text-muted">
          Loading clip details...
        </div>
      }
    >
      <ClipDetailContent />
    </Suspense>
  );
}

function ClipDetailContent() {
  const params = useParams<{ id: string }>();
  const clip = getClipById(params.id);

  const [selectedTier, setSelectedTier] = useState<UseType>("social");

  const { isConnected, address } = useAccount();

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
    usdcBalance !== undefined ? (Number(usdcBalance) / 10 ** USDC_DECIMALS).toFixed(2) : undefined;

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

  const txError = approveError || approveReceiptError || buyError || buyReceiptError;

  if (!clip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <h1 className="mb-2 font-display text-2xl font-bold">Clip Not Found</h1>
        <p className="mb-6 text-muted">The clip you are looking for does not exist.</p>
        <Link
          href="/"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-bg hover:opacity-90"
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
    writeApprove({
      address: USDC_ADDRESS,
      abi: ERC20Abi,
      functionName: "approve",
      args: [SNIPPET_LICENSES_ADDRESS, priceUnits],
      chainId: ARC_TESTNET_CHAIN_ID,
    });
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

  // Back to Step 1. The purchase spent the allowance, so read the fresh value before
  // clearing the old transactions; otherwise Buy could briefly show as ready.
  const handleBuyAnother = async () => {
    await refetchAllowance();
    resetApprove();
    resetBuy();
    setApprovedUnits(null);
    setBuySentAt(null);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

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
            <div className="aspect-video overflow-hidden rounded-2xl border border-line bg-black">
              {/* Plays the light preview; the hashed master (clip.videoUrl) is only for download */}
              <video
                src={clip.previewUrl}
                poster={clip.posterUrl}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full object-contain"
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="font-medium text-primary">{clip.show}</span>
                <span>•</span>
                <span>{clip.duration}</span>
                <span>•</span>
                <span className="rounded bg-surface-2 px-2 py-0.5 font-medium">{clip.contributorName}</span>
              </div>

              <h1 className="font-display text-2xl font-bold sm:text-3xl">{clip.title}</h1>
              <p className="text-muted">{clip.description}</p>
            </div>

            {/* Cryptographic Proof Card */}
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                Onchain Verification Footprint
              </div>
              <div className="flex flex-col gap-1 text-xs text-muted">
                <div>
                  <span className="font-medium">Clip ID (bytes32):</span>{" "}
                  <code className="break-all font-mono text-[11px] text-ink">{clip.clipIdBytes32}</code>
                </div>
                <div>
                  <span className="font-medium">SHA256 Master Hash:</span>{" "}
                  <code className="break-all font-mono text-[11px] text-ink">{clip.fileHash}</code>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: License Picker & Checkout */}
          <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 lg:col-span-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold">Select License Tier</h2>
                <p className="text-xs text-muted">Nonexclusive usage rights recorded permanently on Arc testnet.</p>
              </div>
              {isConnected && formattedBalance !== undefined && (
                <div className="shrink-0 rounded-lg border border-success/40 bg-success/10 px-2.5 py-1 text-right">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-success">
                    Wallet Balance
                  </span>
                  <span className="font-mono text-sm font-bold text-success">${formattedBalance} USDC</span>
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
              ].map((tier) => (
                <button
                  type="button"
                  key={tier.key}
                  onClick={() => setSelectedTier(tier.key)}
                  aria-pressed={selectedTier === tier.key}
                  className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 text-left transition-all ${
                    selectedTier === tier.key
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                      : "border-line hover:border-muted/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{tier.name}</span>
                    <span className="font-display text-base font-bold text-primary">${tier.price} USDC</span>
                  </div>
                  <p className="text-xs text-muted">{tier.desc}</p>
                </button>
              ))}
            </div>

            {/* Split Breakdown Visualizer */}
            <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface-2 p-4">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Direct Split Breakdown</span>
                <span className="text-muted">Atomic in 1 Tx</span>
              </div>
              <div className="flex flex-col gap-1.5 text-xs text-muted">
                <div className="flex items-center justify-between">
                  <span>Host / Rights Holder ({clip.split.rightsHolderBps / 100}%):</span>
                  <span className="font-medium text-ink">${rhAmount.toFixed(2)} USDC</span>
                </div>
                {clip.split.contributorBps > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Guest Royalty ({clip.split.contributorBps / 100}%):</span>
                    <span className="font-medium text-ink">${contribAmount.toFixed(2)} USDC</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Snippet Platform ({clip.split.platformBps / 100}%):</span>
                  <span className="font-medium text-ink">${platformAmount.toFixed(2)} USDC</span>
                </div>
              </div>
            </div>

            {/* Checkout Action Zone */}
            <div className="flex flex-col gap-3 border-t border-line pt-2">
              {!isConnected ? (
                <div className="flex flex-col items-center gap-2 rounded-xl bg-surface-2 p-3">
                  <span className="text-xs text-muted">Connect your wallet to purchase with testnet USDC</span>
                  <ConnectButton />
                </div>
              ) : !isContractReady ? (
                <div className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/10 p-4 text-xs text-ink">
                  <p className="font-semibold">Contract Deployment Pending</p>
                  <p>
                    The UI and video catalog are fully ready. Deploying `SnippetLicenses` to Arc testnet (Step 4) will activate the onchain buy transactions.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Step 1: Approve Button (hidden once this purchase is done) */}
                  {needsApproval && !isBuySuccess && (
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isApprovePending || isApproveConfirming}
                      className="w-full cursor-pointer rounded-xl border border-primary px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                    >
                      {isApprovePending
                        ? "Check Wallet to Approve..."
                        : isApproveConfirming
                        ? "Confirming Approval on Arc..."
                        : `Step 1: Approve $${priceUsd} USDC`}
                    </button>
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
                            { label: "Host", units: issued.rhAmount },
                            ...(issued.contribAmount > BigInt(0) ? [{ label: "Guest", units: issued.contribAmount }] : []),
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
                    <button
                      type="button"
                      onClick={handleBuy}
                      disabled={needsApproval || isBuyPending || isBuyConfirming}
                      className="w-full cursor-pointer rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isBuyPending
                        ? "Check Wallet to Buy..."
                        : isBuyConfirming
                        ? "Purchasing License on Arc..."
                        : needsApproval
                        ? `Step 2: Buy License ($${priceUsd} USDC)`
                        : `Buy License ($${priceUsd} USDC)`}
                    </button>
                  )}

                  {/* Transaction sent, waiting for the receipt */}
                  {buyTxHash && !isBuySuccess && (
                    <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface-2 p-3 text-xs text-ink">
                      <span className="font-semibold">Transaction sent, waiting for Arc to confirm:</span>
                      <a
                        href={`https://testnet.arcscan.app/tx/${buyTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all font-mono text-muted underline hover:text-ink"
                      >
                        {buyTxHash}
                      </a>
                    </div>
                  )}

                  {txError && (
                    <div className="break-words rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs text-ink">
                      {txError.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
