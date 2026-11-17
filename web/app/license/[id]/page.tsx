"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useReadContract } from "wagmi";
import { formatUnits, zeroAddress } from "viem";
import { LogoMark } from "@/components/Logo";
import { SiteHeader } from "@/components/SiteHeader";
import { SnippetLicensesAbi } from "@/lib/abi";
import { ARC_TESTNET_CHAIN_ID, SNIPPET_LICENSES_ADDRESS, USDC_DECIMALS } from "@/lib/arc";
import { DEMO_CLIPS } from "@/lib/clips";
import { EXPLORER_URL, USE_TYPE_NAMES, findLicenseTx } from "@/lib/licenses";

export default function LicensePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8">
        <Suspense fallback={<CertificateSkeleton />}>
          <Certificate />
        </Suspense>
      </main>
    </div>
  );
}

const usdc = (units: bigint) => Number(formatUnits(units, USDC_DECIMALS)).toFixed(2);

function Certificate() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const validId = /^\d+$/.test(params.id) && params.id !== "0";
  const licenseId = validId ? BigInt(params.id) : BigInt(0);

  const { data: license, isLoading, isError, refetch } = useReadContract({
    address: SNIPPET_LICENSES_ADDRESS,
    abi: SnippetLicensesAbi,
    functionName: "getLicense",
    args: [licenseId],
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: validId },
  });

  const client = usePublicClient({ chainId: ARC_TESTNET_CHAIN_ID });
  const exists = !!license && license.buyer !== zeroAddress;
  const txHint = searchParams.get("tx");
  const { data: txHash, isLoading: txLoading } = useQuery({
    queryKey: ["licenseTx", params.id, txHint],
    queryFn: () => findLicenseTx(client!, licenseId, txHint, license?.timestamp),
    enabled: exists && !!client,
    staleTime: Infinity,
  });

  if (!validId || (license && !exists)) {
    return (
      <Notice title={`License #${params.id} not found`}>
        No license with this number has been recorded on the Snippet contract yet.
      </Notice>
    );
  }
  if (isError) {
    return (
      <Notice title="Could not reach Arc testnet">
        The license could not be read right now. Check your connection and{" "}
        <button type="button" onClick={() => refetch()} className="cursor-pointer text-primary underline">
          try again
        </button>
        .
      </Notice>
    );
  }
  if (isLoading || !license) return <CertificateSkeleton />;

  const clip = DEMO_CLIPS.find((c) => c.clipIdBytes32.toLowerCase() === license.clipId.toLowerCase());
  const hashMatches = !!clip && clip.fileHash.toLowerCase() === license.fileHash.toLowerCase();
  const issuedAt = new Date(Number(license.timestamp) * 1000).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const payouts = [
    { label: "Host", units: license.rhAmount },
    ...(license.contribAmount > BigInt(0) ? [{ label: "Guest", units: license.contribAmount }] : []),
    { label: "Snippet", units: license.platformAmount },
  ];

  return (
    <>
      <article
        className="relative overflow-hidden rounded-3xl border border-line bg-surface p-5 sm:p-8"
        aria-label={`License certificate number ${params.id}`}
      >
        {/* Accent bar */}
        <div className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden="true" />

        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <LogoMark className="h-9 w-9 text-ink" />
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Snippet License Certificate
              </p>
              <p className="font-display text-2xl font-bold">No. {params.id.padStart(4, "0")}</p>
            </div>
          </div>
          {hashMatches ? (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-success/50 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
              <span aria-hidden="true">✓</span> Verified on Arc
            </span>
          ) : (
            <span className="inline-flex w-fit rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              File hash does not match the catalog
            </span>
          )}
        </header>

        <div className="mt-6 border-t border-dashed border-line pt-6">
          <p className="text-xs uppercase tracking-wider text-muted">Licensed clip</p>
          <h1 className="mt-1 font-display text-xl font-bold leading-snug sm:text-2xl">
            {clip?.title ?? "Unknown clip"}
          </h1>
          {clip && <p className="mt-1 text-sm text-muted">{clip.show}</p>}
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Use type">
            <span className="rounded-md bg-primary/15 px-2 py-0.5 font-semibold text-primary">
              {USE_TYPE_NAMES[license.useType] ?? "Unknown"}
            </span>
          </Field>
          <Field label="Price paid">
            <span className="font-display text-lg font-bold">${usdc(license.price)} USDC</span>
          </Field>
          <Field label="Licensee" wide>
            <code className="break-all font-mono text-xs">{license.buyer}</code>
          </Field>
          <Field label="Issued">{issuedAt} UTC</Field>
          <Field label="Terms">Nonexclusive, recorded permanently on Arc testnet</Field>
        </dl>

        <div className="mt-6 rounded-2xl bg-surface-2 p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted">Payment split, settled in one transaction</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {payouts.map((p) => (
              <li key={p.label} className="flex justify-between gap-4">
                <span className="text-muted">{p.label}</span>
                <span className="font-mono font-semibold">${usdc(p.units)}</span>
              </li>
            ))}
          </ul>
        </div>

        <dl className="mt-6 flex flex-col gap-4">
          <Field label="Master file hash (SHA256)">
            <code className="break-all font-mono text-xs">{license.fileHash}</code>
          </Field>
          <Field label="Transaction">
            {txHash ? (
              <a
                href={`${EXPLORER_URL}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="break-all font-mono text-xs text-primary underline"
              >
                {txHash} ↗
              </a>
            ) : txLoading ? (
              <span className="inline-block h-4 w-48 animate-pulse rounded bg-surface-2" />
            ) : (
              <a
                href={`${EXPLORER_URL}/address/${SNIPPET_LICENSES_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline"
              >
                View the contract on ArcScan ↗
              </a>
            )}
          </Field>
        </dl>

        <footer className="mt-6 border-t border-dashed border-line pt-4 text-[11px] leading-relaxed text-muted">
          Read live from the SnippetLicenses contract{" "}
          <code className="break-all font-mono">{SNIPPET_LICENSES_ADDRESS}</code> on Arc testnet (chain 5042002).
        </footer>
      </article>

      <ShareActions />

      {clip && (
        <Link href={`/clips/${clip.id}`} className="text-center text-sm text-muted underline hover:text-ink">
          Back to the clip
        </Link>
      )}
    </>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}

function ShareActions() {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked; nothing else to do
    }
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={copy}
        className="flex-1 cursor-pointer rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:border-muted/60"
      >
        {copied ? "Link copied" : "Copy link"}
      </button>
      {canShare && (
        <button
          type="button"
          onClick={() => navigator.share({ title: "Snippet license", url: window.location.href }).catch(() => {})}
          className="flex-1 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90"
        >
          Share
        </button>
      )}
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-8 text-center">
      <h1 className="font-display text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{children}</p>
      <Link href="/" className="mt-6 inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-bg">
        Browse clips
      </Link>
    </div>
  );
}

function CertificateSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-line bg-surface p-5 sm:p-8" aria-label="Loading license">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-surface-2" />
        <div className="flex flex-col gap-2">
          <div className="h-3 w-40 rounded bg-surface-2" />
          <div className="h-6 w-24 rounded bg-surface-2" />
        </div>
      </div>
      <div className="mt-8 h-6 w-3/4 rounded bg-surface-2" />
      <div className="mt-6 grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-surface-2" />
        ))}
      </div>
      <div className="mt-6 h-24 rounded-2xl bg-surface-2" />
      <div className="mt-6 h-10 rounded bg-surface-2" />
    </div>
  );
}
