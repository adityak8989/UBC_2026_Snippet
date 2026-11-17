"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { SiteHeader } from "@/components/SiteHeader";
import { SnippetLicensesAbi } from "@/lib/abi";
import { ARC_TESTNET_CHAIN_ID, SNIPPET_LICENSES_ADDRESS, USDC_DECIMALS } from "@/lib/arc";
import { DEMO_CLIPS } from "@/lib/clips";
import { EXPLORER_URL, USE_TYPE_NAMES, fetchClipLicenses } from "@/lib/licenses";

type Status =
  | { kind: "idle" }
  | { kind: "hashing"; name: string }
  | { kind: "done"; name: string; size: number; hash: `0x${string}` }
  | { kind: "error"; message: string };

// sha256 in the browser with Web Crypto. The file never leaves the device.
async function sha256(file: File): Promise<`0x${string}`> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return `0x${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function CheckPage() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // The on-chain record of every listed clip: file hash and rights holder.
  const { data: onchain, isLoading: clipsLoading, isError: clipsError } = useReadContracts({
    contracts: DEMO_CLIPS.map((c) => ({
      address: SNIPPET_LICENSES_ADDRESS,
      abi: SnippetLicensesAbi,
      functionName: "getClip" as const,
      args: [c.clipIdBytes32] as const,
      chainId: ARC_TESTNET_CHAIN_ID,
    })),
  });

  const hash = status.kind === "done" ? status.hash : undefined;
  const matchIndex =
    hash && onchain
      ? onchain.findIndex((r) => r.status === "success" && r.result.listed && r.result.fileHash.toLowerCase() === hash)
      : -1;
  const match = matchIndex >= 0 ? { clip: DEMO_CLIPS[matchIndex], record: onchain![matchIndex].result! } : undefined;

  const { data: sold, isLoading: soldLoading, isError: soldError } = useQuery({
    queryKey: ["clipLicenses", match?.clip.clipIdBytes32],
    queryFn: () => fetchClipLicenses(match!.clip.clipIdBytes32),
    enabled: !!match,
  });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setStatus({ kind: "hashing", name: file.name });
    try {
      const h = await sha256(file);
      setStatus({ kind: "done", name: file.name, size: file.size, hash: h });
    } catch {
      setStatus({ kind: "error", message: "This file could not be read. Try another file." });
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Is this take cleared?</h1>
          <p className="text-muted">
            Drop a video file to see if it is a licensed clip on Snippet. Your browser fingerprints the file
            (SHA256) and compares it with the fingerprints recorded on Arc. Nothing is uploaded.
          </p>
        </div>

        {/* Drop zone */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed p-8 text-center transition-colors sm:p-12 ${
            dragging ? "border-primary bg-primary/10" : "border-line bg-surface hover:border-muted/60"
          }`}
        >
          <span className="text-4xl" aria-hidden="true">
            🎬
          </span>
          <span className="font-display text-lg font-semibold">Drop a video here</span>
          <span className="text-sm text-muted">or tap to choose a file</span>
          <input
            ref={inputRef}
            type="file"
            accept="video/*,.mp4,.mov,.webm"
            className="sr-only"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>

        {/* Result */}
        <section aria-live="polite" className="flex flex-col gap-4">
          {status.kind === "hashing" && (
            <div className="flex animate-pulse flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
              <p className="font-semibold">Fingerprinting {status.name}…</p>
              <p className="text-xs text-muted">Computing SHA256 locally in your browser.</p>
            </div>
          )}

          {status.kind === "error" && (
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-5 text-sm" role="alert">
              {status.message}
            </div>
          )}

          {status.kind === "done" && (clipsLoading || (!onchain && !clipsError)) && (
            <div className="animate-pulse rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
              Reading the clip registry on Arc…
            </div>
          )}

          {status.kind === "done" && clipsError && (
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-5 text-sm" role="alert">
              Could not reach Arc testnet to compare fingerprints. Check your connection and try again.
            </div>
          )}

          {status.kind === "done" && onchain && match && (
            <div className="flex flex-col gap-4 rounded-3xl border border-success/40 bg-success/5 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success text-xl font-bold text-bg">
                  ✓
                </span>
                <div>
                  <p className="font-display text-xl font-bold text-success">Cleared on Snippet</p>
                  <p className="text-xs text-muted">This exact file is a licensed Snippet clip.</p>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Clip</p>
                <Link href={`/clips/${match.clip.id}`} className="font-display text-lg font-bold hover:text-primary">
                  {match.clip.title}
                </Link>
                <p className="text-sm text-muted">{match.clip.show}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Rights holder (on Arc)</p>
                <a
                  href={`${EXPLORER_URL}/address/${match.record.rightsHolder}`}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono text-xs text-ink underline hover:text-primary"
                >
                  {match.record.rightsHolder}
                </a>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted">
                  Licenses sold{sold ? ` (${sold.length})` : ""}
                </p>
                {soldLoading ? (
                  <div className="h-12 animate-pulse rounded-xl bg-surface-2" />
                ) : soldError ? (
                  <p className="text-sm text-muted">The license list is unavailable right now.</p>
                ) : sold && sold.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {sold.map((l) => (
                      <li key={l.licenseId.toString()}>
                        <Link
                          href={`/license/${l.licenseId}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm hover:border-muted/60"
                        >
                          <span className="font-semibold">License #{l.licenseId.toString()}</span>
                          <span className="text-muted">{USE_TYPE_NAMES[l.useType] ?? "Unknown"}</span>
                          <span className="hidden font-mono text-xs text-muted sm:inline">{short(l.buyer)}</span>
                          <span className="font-mono text-xs">
                            ${Number(formatUnits(l.price, USDC_DECIMALS)).toFixed(2)}
                          </span>
                          <span aria-hidden="true" className="text-primary">
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No licenses have been sold for this clip yet.</p>
                )}
              </div>
            </div>
          )}

          {status.kind === "done" && onchain && !match && (
            <div className="flex flex-col gap-2 rounded-3xl border border-line bg-surface p-5 sm:p-6">
              <p className="font-display text-xl font-bold">Not found on Snippet</p>
              <p className="text-sm text-muted">
                This file does not match any clip licensed on Snippet. Only the exact original file matches: an
                edited, trimmed, or re encoded copy has a different fingerprint.
              </p>
            </div>
          )}

          {status.kind === "done" && (
            <p className="break-all text-center font-mono text-[11px] text-muted">
              {status.name} · {(status.size / 1_000_000).toFixed(1)} MB · SHA256 {status.hash}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
