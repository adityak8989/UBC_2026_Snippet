"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { type PublicClient } from "viem";
import { SnippetLicensesAbi } from "./abi";
import { ARC_TESTNET_CHAIN_ID, SNIPPET_LICENSES_ADDRESS } from "./arc";
import { fetchLicenseEvents, streamsConfigured, subscribeLicenseEvents } from "./licenseEvents";
import { useIsClient } from "./useIsClient";

// Every license sold, newest first: QuickNode Streams' license_events (Supabase, Realtime) first, the
// contract as fallback. One shared query feeds the homepage strip and stats and the "Licensed N times"
// counts on clip cards and clip pages.

export interface Sale {
  licenseId: bigint;
  clipId: string;
  useType: number;
  price: bigint;
  rhAmount: bigint;
  contribAmount: bigint;
  platformAmount: bigint;
  time: Date;
}

export interface Sales {
  source: "streams" | "chain";
  items: Sale[]; // newest first
  // Average seconds between Arc blocks: how soon a sent purchase is final. We can't see when a buyer
  // pressed Buy, so this is the honest proxy, labelled as such. From license_events: (newest sale time
  // minus oldest) / (blocks between them). Fallback: the latest 1000 blocks over RPC.
  blockTime?: { seconds: number; basis: "licenses" | "rpc" };
}

const QUERY_KEY = ["licensesFeed"];
const RPC_SAMPLE_BLOCKS = BigInt(1000);
const CHAIN_SCAN_LIMIT = 200;

async function blockTimeFromRpc(client: PublicClient | undefined): Promise<Sales["blockTime"]> {
  if (!client) return undefined;
  try {
    const latest = await client.getBlock();
    const earlier = await client.getBlock({ blockNumber: latest.number - RPC_SAMPLE_BLOCKS });
    return { seconds: Number(latest.timestamp - earlier.timestamp) / Number(RPC_SAMPLE_BLOCKS), basis: "rpc" };
  } catch {
    return undefined;
  }
}

async function loadSales(client: PublicClient | undefined): Promise<Sales> {
  if (streamsConfigured) {
    try {
      const events = await fetchLicenseEvents();
      const newest = events[0];
      const oldest = events[events.length - 1];
      const blocks = newest && oldest ? Number(newest.blockNumber - oldest.blockNumber) : 0;
      // Needs sales far enough apart (>= 100 blocks) for 1 s timestamps to average out.
      const blockTime: Sales["blockTime"] =
        blocks >= 100
          ? { seconds: (newest.blockTimestamp.getTime() - oldest.blockTimestamp.getTime()) / 1000 / blocks, basis: "licenses" }
          : await blockTimeFromRpc(client);
      return { source: "streams", items: events.map((e) => ({ ...e, time: e.blockTimestamp })), blockTime };
    } catch (err) {
      console.warn("Sales: Supabase unavailable, reading the contract instead", err);
    }
  }
  if (!client) throw new Error("No Arc client");
  const count = await client.readContract({ address: SNIPPET_LICENSES_ADDRESS, abi: SnippetLicensesAbi, functionName: "licenseCount" });
  const first = count > BigInt(CHAIN_SCAN_LIMIT) ? count - BigInt(CHAIN_SCAN_LIMIT) + BigInt(1) : BigInt(1);
  const ids: bigint[] = [];
  for (let id = count; id >= first && id > BigInt(0); id--) ids.push(id);
  const licenses = await Promise.all(
    ids.map((id) => client.readContract({ address: SNIPPET_LICENSES_ADDRESS, abi: SnippetLicensesAbi, functionName: "getLicense", args: [id] })),
  );
  return {
    source: "chain",
    blockTime: await blockTimeFromRpc(client),
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

// One Supabase Realtime channel however many components use the sales: it refetches the shared query the
// moment the Streams webhook writes a row.
let realtimeUsers = 0;
let unsubscribeRealtime: (() => void) | undefined;
function useRealtimeRefresh(queryClient: QueryClient) {
  useEffect(() => {
    if (realtimeUsers++ === 0) {
      unsubscribeRealtime = subscribeLicenseEvents(() => queryClient.invalidateQueries({ queryKey: QUERY_KEY }));
    }
    return () => {
      if (--realtimeUsers === 0) {
        unsubscribeRealtime?.();
        unsubscribeRealtime = undefined;
      }
    };
  }, [queryClient]);
}

export function useSales() {
  const isClient = useIsClient();
  const client = usePublicClient({ chainId: ARC_TESTNET_CHAIN_ID });
  const queryClient = useQueryClient();
  useRealtimeRefresh(queryClient);
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => loadSales(client),
    enabled: isClient,
    refetchInterval: 10_000, // backup to Realtime
  });
}

/** How many licenses a clip has sold, or undefined while loading. */
export function useLicensedCount(clipIdBytes32: string): number | undefined {
  const { data } = useSales();
  return data?.items.filter((s) => s.clipId.toLowerCase() === clipIdBytes32.toLowerCase()).length;
}

/** "Not licensed yet" / "Licensed once" / "Licensed 4 times". */
export function licensedTimesLabel(n: number): string {
  return n === 0 ? "Not licensed yet" : n === 1 ? "Licensed once" : `Licensed ${n} times`;
}
