"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, maxUint256 } from "viem";
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
  const [purchasedTiers, setPurchasedTiers] = useState<Record<UseType, { price: number; txHash: string } | null>>({
    editorial: null,
    social: null,
    commercial: null,
  });

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

  const formattedBalance = usdcBalance !== undefined
    ? (Number(usdcBalance) / 10 ** USDC_DECIMALS).toFixed(2)
    : undefined;

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
      refetchInterval: 3000,
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
  const {
    data: approveReceipt,
    isLoading: isApproveConfirming,
    isSuccess: isApproveLoaded,
  } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  const {
    data: buyReceipt,
    isLoading: isBuyConfirming,
    isSuccess: isBuyReceiptLoaded,
  } = useWaitForTransactionReceipt({
    hash: buyTxHash,
  });

  const isApproveSuccess = isApproveLoaded && approveReceipt?.status === "success";
  const isBuySuccess = isBuyReceiptLoaded && buyReceipt?.status === "success";
  const isBuyReverted = isBuyReceiptLoaded && buyReceipt?.status === "reverted";

  // Refetch balances and allowance after confirmation
  useEffect(() => {
    if (isApproveSuccess) {
      refetchAllowance();
    }
  }, [isApproveSuccess, refetchAllowance]);

  useEffect(() => {
    if (isBuySuccess && buyTxHash) {
      setPurchasedTiers((prev) => ({
        ...prev,
        [selectedTier]: { price: priceUsd, txHash: buyTxHash },
      }));
      refetchBalance();
      refetchAllowance();
    }
  }, [isBuySuccess, buyTxHash]);

  const activeTierLicense = purchasedTiers[selectedTier];
  const isCurrentTierPurchased = !!activeTierLicense;

  // Sync purchase with QuickNode Streams event store
  useEffect(() => {
    if (isBuySuccess && buyTxHash && clip && address) {
      fetch("/api/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseId: Date.now(),
          clipId: clip.clipIdBytes32,
          buyer: address,
          fileHash: clip.fileHash,
          useType: selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1),
          priceUsdc: priceUsd,
          timestamp: Math.floor(Date.now() / 1000),
          txHash: buyTxHash,
        }),
      }).catch((err) => console.warn("Failed to notify streams API:", err));
    }
  }, [isBuySuccess, buyTxHash, clip, address, selectedTier, priceUsd]);

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
      args: [SNIPPET_LICENSES_ADDRESS, maxUint256],
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
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:bg-blue-500 transition-colors">
                S
              </div>
              <span className="font-bold text-xl tracking-tight">Snippet</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-4 text-sm font-medium">
              <Link
                href="/"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Marketplace
              </Link>
              <Link
                href="/check"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Clearance Checker
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-900">
              Arc Testnet
            </span>
            <ConnectButton showBalance={false} />
          </div>
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
                On-Chain Verification Footprint
              </div>
              <div className="text-xs flex flex-col gap-1 text-zinc-600 dark:text-zinc-400">
                <div>
                  <span className="font-medium text-zinc-500">Clip ID (bytes32):</span>{" "}
                  <code className="font-mono break-all text-[11px]">
                    {clip.clipIdBytes32}
                  </code>
                </div>
                <div>
                  <span className="font-medium text-zinc-500">SHA-256 Master Hash:</span>{" "}
                  <code className="font-mono break-all text-[11px]">
                    {clip.fileHash}
                  </code>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: License Picker & Checkout */}
          <div className="lg:col-span-5 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">Select License Tier</h2>
                <p className="text-xs text-zinc-500">
                  Non-exclusive usage rights recorded permanently on Arc testnet.
                </p>
              </div>
              {isConnected && formattedBalance !== undefined && (
                <div className="text-right shrink-0 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-semibold uppercase tracking-wider">
                    Wallet Balance
                  </span>
                  <span className="text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                    ${formattedBalance} USDC
                  </span>
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
                  desc: "News, educational commentary, blog articles, non-commercial media.",
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
                    The UI and video catalog are fully ready. Deploying `SnippetLicenses` to Arc testnet (Step 4) will activate the on-chain buy transactions.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {isCurrentTierPurchased && activeTierLicense ? (
                    /* Success: On-Chain License Certificate & Download */
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                          ✓
                        </span>
                        <span className="capitalize">{selectedTier} License Active!</span>
                      </div>

                      <div className="bg-white/80 dark:bg-zinc-900/80 p-3 rounded-lg border border-emerald-200/60 dark:border-emerald-900/60 flex flex-col gap-1.5 text-zinc-700 dark:text-zinc-300">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Licensee:</span>
                          <span className="font-mono text-[11px] truncate max-w-[180px]">
                            {address}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Use Tier:</span>
                          <span className="font-semibold capitalize text-emerald-600 dark:text-emerald-400">
                            {selectedTier} License
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Amount Paid:</span>
                          <span className="font-bold">${activeTierLicense.price}.00 USDC</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Verified Hash:</span>
                          <span className="font-mono text-[10px] truncate max-w-[180px]">
                            {clip.fileHash}
                          </span>
                        </div>
                      </div>

                      {/* Download Button */}
                      <a
                        href={clip.videoUrl}
                        download={`${clip.id}-master.mp4`}
                        className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-center font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-sm"
                      >
                        <span>⬇</span>
                        <span>Download Master Video (.mp4)</span>
                      </a>

                      <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-400">
                        Select a different tier above to license for other use cases.
                      </p>
                    </div>
                  ) : (
                    <>
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
                            : "Step 1: Approve USDC Access ($0 charged)"}
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
                          ? `Step 2: Pay $${priceUsd} USDC & Buy License`
                          : `Pay $${priceUsd} USDC & Buy License`}
                      </button>

                      {/* Transaction Reverted Warning */}
                      {isBuyReverted && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex flex-col gap-1">
                          <span className="font-bold">Transaction Reverted on Arc Testnet</span>
                          <span>
                            The transfer failed because the contract was not approved to spend your USDC. Please click "Step 1: Approve USDC Access" above, wait for it to confirm in MetaMask, then click "Buy License".
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Transaction In-Flight Feedback */}
                  {buyTxHash && !isBuySuccess && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex flex-col gap-1">
                      <span className="font-semibold">Transaction Broadcasting:</span>
                      <a
                        href={`https://testnet.arcscan.io/tx/${buyTxHash}`}
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
