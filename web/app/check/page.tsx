"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { LicenseEvent } from "@/lib/events";

export default function CheckPage() {
  const pathname = usePathname();
  const [fileHash, setFileHash] = useState("");
  const [isHashing, setIsHashing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [fileName, setFileName] = useState("");
  const [checkResult, setCheckResult] = useState<{
    cleared: boolean;
    message?: string;
    license?: LicenseEvent;
  } | null>(null);

  function handleReset() {
    setFileHash("");
    setFileName("");
    setCheckResult(null);
    setIsHashing(false);
    setIsChecking(false);
  }

  // Always reset to clean dropzone whenever visiting /check
  useEffect(() => {
    handleReset();
  }, [pathname]);

  // Client-side SHA-256 hashing using Web Crypto API + auto-check
  async function handleFileUpload(file: File) {
    setFileName(file.name);
    setIsHashing(true);
    setCheckResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      setFileHash(hashHex);
      setIsHashing(false);

      // Auto-trigger on-chain verification
      await executeCheck(hashHex);
    } catch (err) {
      console.error("Hashing failed:", err);
      setIsHashing(false);
    }
  }

  async function executeCheck(hash: string) {
    if (!hash) return;
    setIsChecking(true);
    setCheckResult(null);

    try {
      const url = new URL("/api/check", window.location.origin);
      url.searchParams.set("fileHash", hash);

      const res = await fetch(url.toString());
      const data = await res.json();
      setCheckResult(data);
    } catch (err) {
      setCheckResult({
        cleared: false,
        message: "Failed to query license records: " + String(err),
      });
    } finally {
      setIsChecking(false);
    }
  }

  function handleReset() {
    setFileHash("");
    setFileName("");
    setCheckResult(null);
    setIsHashing(false);
    setIsChecking(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:bg-blue-500 transition-colors">
                S
              </div>
              <span className="font-bold text-xl tracking-tight">Snippet</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-5 text-sm font-medium">
              <Link
                href="/"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Marketplace
              </Link>
              <Link
                href="/check"
                className="text-blue-600 dark:text-blue-400 font-semibold"
              >
                License Checker
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-xs px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-900">
              Arc Testnet
            </span>
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12 flex flex-col gap-8">
        <div className="text-center flex flex-col gap-2">
          <div className="inline-flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <span>Powered by QuickNode Streams</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Check License
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto text-sm">
            Upload any downloaded video or audio file to instantly verify whether it carries a legally registered, on-chain license issued on Arc testnet.
          </p>
        </div>

        {/* Checker Card */}
        <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-6">
          {/* File Dropzone */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Upload Video / Audio File:
            </label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl p-8 sm:p-10 text-center flex flex-col items-center justify-center gap-3 bg-zinc-50/50 dark:bg-zinc-800/30 transition-colors cursor-pointer"
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept="video/*,audio/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl">
                📁
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-base">
                  {fileName ? fileName : "Click to select or drag & drop video file"}
                </span>
                <span className="text-xs text-zinc-400">
                  {isHashing
                    ? "Calculating cryptographic SHA-256 fingerprint in browser..."
                    : isChecking
                    ? "Querying on-chain license registry on Arc..."
                    : "Supports MP4, MOV, WebM, WAV, MP3"}
                </span>
              </div>
            </div>
          </div>

          {/* SHA-256 Hash Display (if hashed) */}
          {fileHash && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs flex flex-col gap-1">
              <span className="text-zinc-500 font-medium">Cryptographic File Fingerprint (SHA-256):</span>
              <code className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 break-all">
                {fileHash}
              </code>
            </div>
          )}

          {/* Result Card */}
          {checkResult && (
            <div className="pt-2">
              {checkResult.cleared && checkResult.license ? (
                <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col gap-4">
                  <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 font-extrabold text-lg">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm shadow-sm">
                      ✓
                    </span>
                    <span>LICENSED & VERIFIED ON-CHAIN</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white/90 dark:bg-zinc-900/90 p-4 rounded-lg border border-emerald-200/60 dark:border-emerald-900/60">
                    <div>
                      <span className="text-zinc-500 block">Licensed Footage:</span>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                        {checkResult.license.clipTitle}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block">Use Tier:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        {checkResult.license.useType} License (${checkResult.license.priceUsdc} USDC)
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block">Licensee Wallet:</span>
                      <span className="font-mono text-[11px] break-all text-zinc-800 dark:text-zinc-200 font-medium">
                        {checkResult.license.buyer}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block">Transaction Hash:</span>
                      <span className="font-mono text-[11px] break-all text-zinc-700 dark:text-zinc-300">
                        {checkResult.license.txHash}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                    <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 italic">
                      Verified against Arc testnet event logs via QuickNode Streams.
                    </p>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition-colors cursor-pointer"
                    >
                      Check Another File
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-bold text-base">
                    <span className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs">
                      ✕
                    </span>
                    <span>NO VALID LICENSE FOUND</span>
                  </div>
                  <p className="text-xs text-red-700 dark:text-red-400">
                    This file fingerprint has no recorded license on Arc testnet. Any commercial or social media usage of this footage is currently unlicensed.
                  </p>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                    <Link
                      href="/"
                      className="text-xs font-semibold text-red-800 dark:text-red-300 underline"
                    >
                      Browse Marketplace to License this Footage →
                    </Link>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium text-xs shadow-sm transition-colors cursor-pointer"
                    >
                      Check Another File
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
