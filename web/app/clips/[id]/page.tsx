"use client";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { getClipById } from "@/lib/clips";
import { USDC_ADDRESS, USDC_DECIMALS, SNIPPET_LICENSES_ADDRESS, ARC_TESTNET_CHAIN_ID } from "@/lib/arc";
import { SnippetLicensesAbi, ERC20Abi } from "@/lib/abi";

type UseType = "editorial" | "social" | "commercial";

const USE_TYPE_INDEX: Record<UseType, number> = {
  editorial: 0,
  social: 1,
  commercial: 2,
};

export default function ClipDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-8 text-zinc-500">
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

  const needsApproval = isContractReady && (allowance === undefined || allowance < priceUnits);

  // Wagmi write hooks
  const {
    data: approveTxHash,
    writeContract: writeApprove,
    isPending: isApprovePending,
    error: approveError,
  } = useWriteContract();

  const {
    data: buyTxHash,
    writeContract: writeBuy,
    isPending: isBuyPending,
    error: buyError,
  } = useWriteContract();

  // Transaction confirmations
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({
      hash: approveTxHash,
    });

  const { isLoading: isBuyConfirming, isSuccess: isBuySuccess } =
    useWaitForTransactionReceipt({
      hash: buyTxHash,
    });

  // Refetch allowance after approval succeeds
  if (isApproveSuccess && needsApproval) {
    refetchAllowance();
  }

  if (!clip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Clip Not Found</h1>
        <p className="text-zinc-500 mb-6">The clip you are looking for does not exist.</p>
        <Link
          href="/"
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500"
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
    writeBuy({
      address: SNIPPET_LICENSES_ADDRESS,
      abi: SnippetLicensesAbi,
      functionName: "buyLicense",
      args: [clip.clipIdBytes32, USE_TYPE_INDEX[selectedTier]],
      chainId: ARC_TESTNET_CHAIN_ID,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:bg-blue-500 transition-colors">
                S
              </div>
              <span className="font-bold text-xl tracking-tight">Snippet</span>
            </Link>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-900">
              Arc Testnet
            </span>
          </div>
          <ConnectButton showBalance={false} />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors font-medium w-fit"
        >
          ← Back to Marketplace
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Video & Metadata */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-black rounded-2xl overflow-hidden aspect-video shadow-md border border-zinc-200 dark:border-zinc-800">
              <video
                src={clip.videoUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {clip.show}
                </span>
                <span>•</span>
                <span>{clip.duration}</span>
                <span>•</span>
                <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-medium">
                  {clip.contributorName}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold">{clip.title}</h1>
              <p className="text-zinc-600 dark:text-zinc-400">{clip.description}</p>
            </div>

            {/* Cryptographic Proof Card */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Onchain Verification Footprint
              </div>
              <div className="text-xs flex flex-col gap-1 text-zinc-600 dark:text-zinc-400">
                <div>
                  <span className="font-medium text-zinc-500">Clip ID (bytes32):</span>{" "}
                  <code className="font-mono break-all text-[11px]">
                    {clip.clipIdBytes32}
                  </code>
                </div>
                <div>
                  <span className="font-medium text-zinc-500">SHA256 Master Hash:</span>{" "}
                  <code className="font-mono break-all text-[11px]">
                    {clip.fileHash}
                  </code>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: License Picker & Checkout */}
          <div className="lg:col-span-5 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold">Select License Tier</h2>
              <p className="text-xs text-zinc-500">
                Nonexclusive usage rights recorded permanently on Arc testnet.
              </p>
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
                  className={`text-left p-4 rounded-xl border transition-all flex flex-col gap-1 cursor-pointer ${
                    selectedTier === tier.key
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-blue-600/20"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{tier.name}</span>
                    <span className="font-extrabold text-base text-blue-600 dark:text-blue-400">
                      ${tier.price} USDC
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{tier.desc}</p>
                </button>
              ))}
            </div>

            {/* Split Breakdown Visualizer */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Direct Split Breakdown</span>
                <span className="text-zinc-500">Atomic in 1 Tx</span>
              </div>
              <div className="flex flex-col gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center justify-between">
                  <span>Host / Rights Holder ({clip.split.rightsHolderBps / 100}%):</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    ${rhAmount.toFixed(2)} USDC
                  </span>
                </div>
                {clip.split.contributorBps > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Guest Royalty ({clip.split.contributorBps / 100}%):</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      ${contribAmount.toFixed(2)} USDC
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Snippet Platform ({clip.split.platformBps / 100}%):</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    ${platformAmount.toFixed(2)} USDC
                  </span>
                </div>
              </div>
            </div>

            {/* Checkout Action Zone */}
            <div className="flex flex-col gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              {!isConnected ? (
                <div className="flex flex-col items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl">
                  <span className="text-xs text-zinc-500">
                    Connect your wallet to purchase with testnet USDC
                  </span>
                  <ConnectButton />
                </div>
              ) : !isContractReady ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs flex flex-col gap-2">
                  <p className="font-semibold">Contract Deployment Pending</p>
                  <p>
                    The UI and video catalog are fully ready. Deploying `SnippetLicenses` to Arc testnet (Step 4) will activate the onchain buy transactions.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Step 1: Approve Button */}
                  {needsApproval && (
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isApprovePending || isApproveConfirming}
                      className="w-full py-3 px-4 rounded-xl font-medium bg-amber-500 hover:bg-amber-400 text-white shadow-sm transition-colors text-sm disabled:opacity-50 cursor-pointer"
                    >
                      {isApprovePending
                        ? "Check Wallet to Approve..."
                        : isApproveConfirming
                        ? "Confirming Approval on Arc..."
                        : `Step 1: Approve $${priceUsd} USDC`}
                    </button>
                  )}

                  {/* Step 2: Buy Button */}
                  <button
                    type="button"
                    onClick={handleBuy}
                    disabled={needsApproval || isBuyPending || isBuyConfirming}
                    className="w-full py-3 px-4 rounded-xl font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isBuyPending
                      ? "Check Wallet to Buy..."
                      : isBuyConfirming
                      ? "Purchasing License on Arc..."
                      : needsApproval
                      ? `Step 2: Buy License ($${priceUsd} USDC)`
                      : `Buy License ($${priceUsd} USDC)`}
                  </button>

                  {/* Transaction Feedback */}
                  {buyTxHash && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex flex-col gap-1">
                      <span className="font-semibold">
                        {isBuySuccess ? "License Successfully Purchased!" : "Transaction Sent:"}
                      </span>
                      <a
                        href={`https://testnet.arcscan.app/tx/${buyTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-mono break-all hover:text-blue-600"
                      >
                        {buyTxHash}
                      </a>
                    </div>
                  )}

                  {(approveError || buyError) && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-400 break-words">
                      {approveError?.message || buyError?.message}
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
