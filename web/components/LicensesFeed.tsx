"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { formatUnits, type PublicClient } from "viem";
import { SnippetLicensesAbi } from "@/lib/abi";
import { ARC_TESTNET_CHAIN_ID, SNIPPET_LICENSES_ADDRESS, USDC_DECIMALS } from "@/lib/arc";
import { DEMO_CLIPS } from "@/lib/clips";
import { fetchLicenseEvents, streamsConfigured, subscribeLicenseEvents } from "@/lib/licenseEvents";
import { USE_TYPE_NAMES } from "@/lib/licenses";
import { useIsClient } from "@/lib/useIsClient";

interface FeedItem {
  licenseId: bigint;
  clipId: string;
  useType: number;
  price: bigint;
  rhAmount: bigint;
  contribAmount: bigint;
  platformAmount: bigint;
  time: Date;
}

interface Feed {
  source: "streams" | "chain";
  items: FeedItem[]; // newest first
}

const SHOWN = 8;
const CHAIN_SCAN_LIMIT = 200;

// QuickNode Streams -> license_events is the source; the contract is the fallback.
async function loadFeed(client: PublicClient | undefined): Promise<Feed> {
  if (streamsConfigured) {
    try {
      const events = await fetchLicenseEvents();
      return {
        source: "streams",
        items: events.map((e) => ({ ...e, time: e.blockTimestamp })),
      };
    } catch (err) {
      console.warn("Licenses feed: Supabase unavailable, reading the contract instead", err);
    }
  }
  if (!client) throw new Error("No Arc client");
  const count = await client.readContract({
    address: SNIPPET_LICENSES_ADDRESS,
    abi: SnippetLicensesAbi,
    functionName: "licenseCount",
  });
  const first = count > BigInt(CHAIN_SCAN_LIMIT) ? count - BigInt(CHAIN_SCAN_LIMIT) + BigInt(1) : BigInt(1);
  const ids: bigint[] = [];
  for (let id = count; id >= first && id > BigInt(0); id--) ids.push(id);
  const licenses = await Promise.all(
    ids.map((id) =>
      client.readContract({ address: SNIPPET_LICENSES_ADDRESS, abi: SnippetLicensesAbi, functionName: "getLicense", args: [id] }),
    ),
  );
  return {
    source: "chain",
    items: licenses.map((l, i) => ({
      licenseId: ids[i],
      clipId: l.clipId,
      useType: l.useType,
      price: l.price,
      rhAmount: l.rhAmount,
      contribAmount: l.contribAmount,
      platformAmount: l.platformAmount,
      time: new Date(Number(l.timestamp) * 1000),
    })),
  };
}

const usdc = (units: bigint) => Number(formatUnits(units, USDC_DECIMALS)).toFixed(2);

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function timeAgo(date: Date, now: number): string {
  const s = Math.round((date.getTime() - now) / 1000);
  if (Math.abs(s) < 45) return "just now";
  const m = Math.round(s / 60);
  if (Math.abs(m) < 60) return rtf.format(m, "minute");
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return rtf.format(h, "hour");
  return rtf.format(Math.round(h / 24), "day");
}

// A clock for "time ago" that only reads the time in the browser (after hydration) and ticks every
// 15 s. Reading Date.now() during render breaks prerendering under Cache Components.
let clockNow = 0;
function subscribeClock(onTick: () => void) {
  clockNow = Date.now();
  onTick();
  const t = setInterval(() => {
    clockNow = Date.now();
    onTick();
  }, 15_000);
  return () => clearInterval(t);
}
function useNow() {
  return useSyncExternalStore(
    subscribeClock,
    () => clockNow,
    () => 0,
  );
}

export function LicensesFeed() {
  const isClient = useIsClient();
  const client = usePublicClient({ chainId: ARC_TESTNET_CHAIN_ID });
  const queryClient = useQueryClient();
  const now = useNow();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["licensesFeed"],
    queryFn: () => loadFeed(client),
    enabled: isClient,
    refetchInterval: 10_000, // backup to Realtime
  });

  // Supabase Realtime: refetch the moment the Streams webhook writes a row.
  useEffect(() => subscribeLicenseEvents(() => queryClient.invalidateQueries({ queryKey: ["licensesFeed"] })), [queryClient]);

  const items = data?.items ?? [];
  const totalToCreators = items.reduce((sum, i) => sum + i.rhAmount + i.contribAmount, BigInt(0));

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="licenses-sold">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="licenses-sold" className="flex items-center gap-2 font-display text-xl font-bold">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          Licenses sold
        </h2>
        {data && (
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
              data.source === "streams" ? "border-success/40 bg-success/10 text-success" : "border-line text-muted"
            }`}
          >
            {data.source === "streams" ? "Live via QuickNode Streams" : "Read from Arc"}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Licenses sold" value={data ? items.length.toString() : undefined} />
        <Stat label="USDC paid to creators" value={data ? `$${usdc(totalToCreators)}` : undefined} />
      </div>

      {/* Feed */}
      {!isClient || isLoading ? (
        <ul className="flex flex-col gap-2" aria-label="Loading licenses">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="h-16 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </ul>
      ) : isError ? (
        <p className="text-sm text-muted">
          The feed is unavailable right now.{" "}
          <button type="button" onClick={() => refetch()} className="cursor-pointer text-primary underline">
            Try again
          </button>
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">No licenses sold yet. Be the first.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.slice(0, SHOWN).map((item) => {
            const clip = DEMO_CLIPS.find((c) => c.clipIdBytes32.toLowerCase() === item.clipId.toLowerCase());
            const fresh = now > 0 && now - item.time.getTime() < 60_000;
            return (
              <li key={item.licenseId.toString()}>
                <Link
                  href={`/license/${item.licenseId}`}
                  className={`flex flex-col gap-1 rounded-xl border px-4 py-3 transition-colors hover:border-muted/60 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${
                    fresh ? "border-success/50 bg-success/5" : "border-line bg-bg/40"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 font-mono text-xs text-muted">#{item.licenseId.toString()}</span>
                    <span className="truncate font-semibold">{clip?.title ?? "Unlisted clip"}</span>
                    <span className="shrink-0 rounded-md bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                      {USE_TYPE_NAMES[item.useType] ?? "Unknown"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="font-mono font-semibold text-ink">${usdc(item.price)}</span>
                    <span className="font-mono">
                      {usdc(item.rhAmount)} creator
                      {item.contribAmount > BigInt(0) ? ` · ${usdc(item.contribAmount)} contributor` : ""} ·{" "}
                      {usdc(item.platformAmount)} Snippet
                    </span>
                    <span className={fresh ? "font-semibold text-success" : ""}>{now > 0 ? timeAgo(item.time, now) : ""}</span>
                    <span aria-hidden="true" className="text-primary">
                      →
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      {value === undefined ? (
        <div className="mt-1 h-7 w-16 animate-pulse rounded bg-line" />
      ) : (
        <p className="font-display text-2xl font-bold">{value}</p>
      )}
    </div>
  );
}
