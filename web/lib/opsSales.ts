import "server-only";
import { formatUnits } from "viem";
import { SnippetLicensesAbi } from "./abi";
import { SNIPPET_LICENSES_ADDRESS, USDC_DECIMALS } from "./arc";
import { DEMO_CLIPS } from "./clips";
import { getCreator } from "./creators";
import { fetchLicenseEvents, streamsConfigured, type LicenseEvent } from "./licenseEvents";
import { EXPLORER_URL, USE_TYPE_NAMES } from "./licenses";
import { readArc } from "./serverChain";

// Ops data feed for the Snippet Ops Bot (Grok): recent sales and today's earnings, as JSON (/api/ops/sales)
// and plain text (/api/ops/sales.txt). Public, read only, cached at most 30 s. Source: QuickNode Streams'
// license_events; the contract (through QuickNode RPC) as fallback. Holds no keys and moves no money.

export const SITE_URL = "https://snippet-gamma.vercel.app";
export const OPS_TIMEZONE = "America/Chicago";
const MAX_SALES = 50;
const CHAIN_SCAN_LIMIT = 200;

export interface OpsSale {
  licenseId: string;
  clipId: string;
  clipTitle: string;
  creator: string;
  useType: string;
  priceUsd: number;
  creatorPayoutUsd: number;
  contributor: { name: string; usd: number } | null;
  platformUsd: number;
  timestamp: string; // ISO 8601, UTC
  certificateUrl: string;
  explorerUrl: string | null; // the transaction; null when read from the contract (no tx hash there)
}

export interface OpsSummary {
  date: string; // YYYY-MM-DD in America/Chicago
  timezone: string;
  salesToday: number;
  grossUsdToday: number;
  creators: { name: string; sales: number; earnedUsd: number }[];
  contributors: { name: string; sales: number; earnedUsd: number }[];
}

export interface OpsSales {
  generatedAt: string;
  source: "streams" | "chain";
  since: string | null;
  sales: OpsSale[]; // newest first, at most 50
  summary: OpsSummary;
}

interface RawSale {
  licenseId: bigint;
  clipId: string;
  useType: number;
  price: bigint;
  rhAmount: bigint;
  contribAmount: bigint;
  platformAmount: bigint;
  time: Date;
  txHash: string | null;
}

const usd = (units: bigint) => Math.round(Number(formatUnits(units, USDC_DECIMALS)) * 100) / 100;
const chicagoDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: OPS_TIMEZONE }).format(d); // YYYY-MM-DD

async function loadRawSales(): Promise<{ source: "streams" | "chain"; sales: RawSale[] }> {
  if (streamsConfigured) {
    try {
      const events: LicenseEvent[] = await fetchLicenseEvents(1000);
      return {
        source: "streams",
        sales: events.map((e) => ({ ...e, time: e.blockTimestamp, txHash: e.txHash })),
      };
    } catch (err) {
      console.warn("ops: Supabase unavailable, reading the contract instead", (err as Error)?.name);
    }
  }
  const { value } = await readArc(async (client) => {
    const count = await client.readContract({ address: SNIPPET_LICENSES_ADDRESS, abi: SnippetLicensesAbi, functionName: "licenseCount" });
    const ids: bigint[] = [];
    for (let id = count; id > BigInt(0) && ids.length < CHAIN_SCAN_LIMIT; id--) ids.push(id);
    const licenses = await Promise.all(
      ids.map((id) => client.readContract({ address: SNIPPET_LICENSES_ADDRESS, abi: SnippetLicensesAbi, functionName: "getLicense", args: [id] })),
    );
    return licenses.map((l, i) => ({
      licenseId: ids[i],
      clipId: l.clipId,
      useType: l.useType,
      price: l.price,
      rhAmount: l.rhAmount,
      contribAmount: l.contribAmount,
      platformAmount: l.platformAmount,
      time: new Date(Number(l.timestamp) * 1000),
      txHash: null,
    }));
  });
  return { source: "chain", sales: value };
}

function toOpsSale(s: RawSale): OpsSale {
  const clip = DEMO_CLIPS.find((c) => c.clipIdBytes32.toLowerCase() === s.clipId.toLowerCase());
  const creator = getCreator(clip)?.name ?? "Rights holder";
  const contributorName = clip?.contributorName || "Contributor";
  return {
    licenseId: s.licenseId.toString(),
    clipId: clip?.id ?? s.clipId,
    clipTitle: clip?.title ?? "Unknown clip",
    creator,
    useType: USE_TYPE_NAMES[s.useType] ?? "Unknown",
    priceUsd: usd(s.price),
    creatorPayoutUsd: usd(s.rhAmount),
    contributor: s.contribAmount > BigInt(0) ? { name: contributorName, usd: usd(s.contribAmount) } : null,
    platformUsd: usd(s.platformAmount),
    timestamp: s.time.toISOString(),
    certificateUrl: `${SITE_URL}/license/${s.licenseId}`,
    explorerUrl: s.txHash ? `${EXPLORER_URL}/tx/${s.txHash}` : null,
  };
}

function summarize(all: OpsSale[], now: Date): OpsSummary {
  const date = chicagoDay(now);
  const today = all.filter((s) => chicagoDay(new Date(s.timestamp)) === date);
  const creators = new Map<string, { sales: number; cents: number }>();
  const contributors = new Map<string, { sales: number; cents: number }>();
  for (const s of today) {
    const c = creators.get(s.creator) ?? { sales: 0, cents: 0 };
    creators.set(s.creator, { sales: c.sales + 1, cents: c.cents + Math.round(s.creatorPayoutUsd * 100) });
    if (s.contributor) {
      const k = contributors.get(s.contributor.name) ?? { sales: 0, cents: 0 };
      contributors.set(s.contributor.name, { sales: k.sales + 1, cents: k.cents + Math.round(s.contributor.usd * 100) });
    }
  }
  const list = (m: Map<string, { sales: number; cents: number }>) =>
    [...m.entries()].map(([name, v]) => ({ name, sales: v.sales, earnedUsd: v.cents / 100 })).sort((a, b) => b.earnedUsd - a.earnedUsd);
  return {
    date,
    timezone: OPS_TIMEZONE,
    salesToday: today.length,
    grossUsdToday: today.reduce((sum, s) => sum + Math.round(s.priceUsd * 100), 0) / 100,
    creators: list(creators),
    contributors: list(contributors),
  };
}

/** Parses ?since=<ISO time>; undefined when absent, null when invalid. */
export function parseSince(value: string | null): Date | undefined | null {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getOpsSales(since?: Date): Promise<OpsSales> {
  const now = new Date();
  const { source, sales } = await loadRawSales();
  const all = sales.map(toOpsSale).sort((a, b) => Number(BigInt(b.licenseId) - BigInt(a.licenseId)));
  const filtered = since ? all.filter((s) => new Date(s.timestamp) > since) : all;
  return {
    generatedAt: now.toISOString(),
    source,
    since: since ? since.toISOString() : null,
    sales: filtered.slice(0, MAX_SALES),
    summary: summarize(all, now),
  };
}

const money = (n: number) => `$${n.toFixed(2)}`;
const when = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: OPS_TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));

/** One line per sale, then the summary: easy for a bot (or a person) to read. */
export function opsSalesText(data: OpsSales): string {
  const lines: string[] = [];
  lines.push(`Snippet sales feed · generated ${data.generatedAt} · source ${data.source === "streams" ? "QuickNode Streams" : "Arc contract"}`);
  if (data.since) lines.push(`Only sales after ${data.since}`);
  lines.push("");
  lines.push(`SALES (${data.sales.length}, newest first)`);
  if (data.sales.length === 0) lines.push("No sales.");
  for (const s of data.sales) {
    const contributor = s.contributor ? ` · ${s.contributor.name} ${money(s.contributor.usd)}` : "";
    lines.push(
      `#${s.licenseId} · ${when(s.timestamp)} · ${s.clipTitle} (${s.useType}) · ${money(s.priceUsd)} USDC · ${s.creator} ${money(s.creatorPayoutUsd)}${contributor} · Snippet ${money(s.platformUsd)} · ${s.certificateUrl}`,
    );
  }
  const t = data.summary;
  lines.push("");
  lines.push(`TODAY ${t.date} (${t.timezone}): ${t.salesToday} sale${t.salesToday === 1 ? "" : "s"}, ${money(t.grossUsdToday)} gross`);
  for (const c of t.creators) lines.push(`Creator ${c.name}: ${money(c.earnedUsd)} from ${c.sales} sale${c.sales === 1 ? "" : "s"}`);
  for (const c of t.contributors) lines.push(`Contributor ${c.name}: ${money(c.earnedUsd)} from ${c.sales} sale${c.sales === 1 ? "" : "s"}`);
  return lines.join("\n") + "\n";
}

export const OPS_CACHE_HEADERS = {
  // Shared caches (Vercel's CDN) may reuse a response for at most 30 s; browsers always revalidate.
  "cache-control": "public, max-age=0, s-maxage=30",
  "access-control-allow-origin": "*",
};
