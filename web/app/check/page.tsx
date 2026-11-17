"use client";

import { useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { DEMO_CLIPS } from "@/lib/clips";
import { LicenseEvent } from "@/lib/events";

export default function CheckPage() {
  const [fileHash, setFileHash] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [isHashing, setIsHashing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [fileName, setFileName] = useState("");
  const [checkResult, setCheckResult] = useState<{
    cleared: boolean;
    message?: string;
    license?: LicenseEvent;
  } | null>(null);

  // Client-side SHA-256 hashing using Web Crypto API
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
    } catch (err) {
      console.error("Hashing failed:", err);
    } finally {
      setIsHashing(false);
    }
  }

  async function handleCheck(targetHash?: string) {
    const hash = targetHash || fileHash;
    if (!hash) return;

    setIsChecking(true);
    setCheckResult(null);

    try {
      const url = new URL("/api/check", window.location.origin);
      url.searchParams.set("fileHash", hash);
      if (buyerAddress.trim()) {
        url.searchParams.set("buyer", buyerAddress.trim());
      }

      const res = await fetch(url.toString());
      const data = await res.json();
      setCheckResult(data);
    } catch (err) {
      setCheckResult({
        cleared: false,
        message: "Failed to query clearance records: " + String(err),
      });
    } finally {
      setIsChecking(false);
    }
  }

  function handleSelectDemoClip(clipHash: string, name: string) {
    setFileHash(clipHash);
    setFileName(name);
    handleCheck(clipHash);
  }

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
                className="text-blue-600 dark:text-blue-400 font-semibold"
              >
                Clearance Checker
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-900">
              Arc Testnet
            </span>
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10 flex flex-col gap-8">
        <div className="text-center flex flex-col gap-2">
          <div className="inline-flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <span>Powered by QuickNode Streams</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Is This Take Cleared?
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto text-sm">
            Drop an audio or video clip to verify whether it carries a legally registered, on-chain license issued on Arc testnet.
          </p>
        </div>

        {/* Checker Card */}
        <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-6">
          {/* File Dropzone */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Step 1: Drop Video / Audio File
            </label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3 bg-zinc-50/50 dark:bg-zinc-800/30 transition-colors cursor-pointer"
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
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl">
                📁
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-sm">
                  {fileName ? fileName : "Click to select or drag and drop a file"}
                </span>
                <span className="text-xs text-zinc-400">
                  {isHashing
                    ? "Calculating cryptographic SHA-256 fingerprint in browser..."
                    : "File is hashed client-side in your browser (not uploaded)"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Demo Pickers */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Or Try a Demo Clip (1-Click Test):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {DEMO_CLIPS.map((clip) => (
                <button
                  type="button"
                  key={clip.id}
                  onClick={() => handleSelectDemoClip(clip.fileHash, `${clip.title} (.mp4)`)}
                  className="p-2.5 text-left rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-400 bg-zinc-50 dark:bg-zinc-800/40 text-xs transition-colors cursor-pointer"
                >
                  <span className="font-semibold block truncate">{clip.title}</span>
                  <span className="text-[11px] text-zinc-400 font-mono truncate block">
                    {clip.fileHash.slice(0, 16)}...
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Hash Input Field */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              SHA-256 File Hash (auto-filled):
            </label>
            <input
              type="text"
              value={fileHash}
              onChange={(e) => setFileHash(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Optional Buyer Wallet Filter */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Buyer Wallet Address (Optional):
            </label>
            <input
              type="text"
              value={buyerAddress}
              onChange={(e) => setBuyerAddress(e.target.value)}
              placeholder="0x... (leave blank to verify if ANY buyer holds a license)"
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Check Button */}
          <button
            type="button"
            onClick={() => handleCheck()}
            disabled={!fileHash || isChecking || isHashing}
            className="w-full py-3 px-4 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors text-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {isChecking ? "Checking QuickNode Streams Records..." : "Check Clearance On-Chain →"}
          </button>

          {/* Result Card */}
          {checkResult && (
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
              {checkResult.cleared && checkResult.license ? (
                <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col gap-3">
                  <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 font-extrabold text-base">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm shadow-sm">
                      ✓
                    </span>
                    <span>CLEARED FOR USE ON-CHAIN</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white/80 dark:bg-zinc-900/80 p-4 rounded-lg border border-emerald-200/60 dark:border-emerald-900/60">
                    <div>
                      <span className="text-zinc-500 block">Licensed Moment:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {checkResult.license.clipTitle}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block">Use Tier:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {checkResult.license.useType} License (${checkResult.license.priceUsdc} USDC)
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block">Licensee Wallet:</span>
                      <span className="font-mono text-[11px] break-all text-zinc-800 dark:text-zinc-200">
                        {checkResult.license.buyer}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block">On-Chain Tx:</span>
                      <a
                        href={`https://testnet.arcscan.io/tx/${checkResult.license.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] underline text-blue-600 dark:text-blue-400 break-all"
                      >
                        {checkResult.license.txHash.slice(0, 18)}...
                      </a>
                    </div>
                  </div>

                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 italic">
                    Verified against Arc testnet event logs via QuickNode Streams. Matches exact cryptographic file fingerprint.
                  </p>
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-bold text-sm">
                    <span className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs">
                      ✕
                    </span>
                    <span>NO VALID LICENSE FOUND</span>
                  </div>
                  <p className="text-xs text-red-700 dark:text-red-400">
                    This file fingerprint has no recorded license matching this wallet on Arc testnet. Any commercial or social media usage of this audio/video is currently unlicensed.
                  </p>
                  <Link
                    href="/"
                    className="text-xs font-semibold text-red-800 dark:text-red-300 underline mt-1"
                  >
                    Browse Marketplace to License this Clip →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
