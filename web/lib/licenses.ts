import { parseEventLogs, toHex, type PublicClient } from "viem";
import { SnippetLicensesAbi } from "./abi";
import { SNIPPET_LICENSES_ADDRESS } from "./arc";
import { fetchLicenseEventsForBuyer, fetchLicenseEventsForClip, streamsConfigured } from "./licenseEvents";

export const EXPLORER_URL = "https://testnet.arcscan.app";
// Blockscout API behind testnet.arcscan.app (allows cross origin requests).
const EXPLORER_API = "https://explorer.testnet.arc.io/api";

export const USE_TYPE_NAMES = ["Editorial", "Social", "Commercial"] as const;

// keccak256("LicenseIssued(uint256,bytes32,address,bytes32,uint8,uint256,uint256,uint256,uint256,uint64)")
const LICENSE_ISSUED_TOPIC = "0x019c42efa4a2ed077d7577fc401e2f0dfcf241fd5f419761e314dd00c73cfd8d";

// Finds the transaction that issued a license, in order:
//   1. the tx hash from the receipt link, if it really issued this license;
//   2. the explorer API (one request, but it rate limits);
//   3. the public RPC: find the block at the license's timestamp, then search a small window of logs
//      (the RPC refuses log searches over thousands of blocks, so it can't scan from the start).
export async function findLicenseTx(
  client: PublicClient,
  licenseId: bigint,
  hint?: string | null,
  timestamp?: bigint,
): Promise<`0x${string}` | null> {
  const viaHintOrExplorer = await findViaHintOrExplorer(client, licenseId, hint).catch(() => null);
  if (viaHintOrExplorer) return viaHintOrExplorer;
  if (timestamp === undefined) return null;
  return findViaRpc(client, licenseId, timestamp).catch(() => null);
}

async function findViaRpc(client: PublicClient, licenseId: bigint, timestamp: bigint) {
  // Binary search for the last block at or before the license timestamp (about 27 lookups).
  let lo = BigInt(0);
  let hi = await client.getBlockNumber();
  while (lo < hi) {
    const mid = (lo + hi + BigInt(1)) / BigInt(2);
    const block = await client.getBlock({ blockNumber: mid });
    if (block.timestamp <= timestamp) lo = mid;
    else hi = mid - BigInt(1);
  }
  // Timestamps have 1 s granularity and Arc makes ~2 blocks per second, so search around it.
  const logs = await client.getContractEvents({
    address: SNIPPET_LICENSES_ADDRESS,
    abi: SnippetLicensesAbi,
    eventName: "LicenseIssued",
    args: { licenseId },
    fromBlock: lo > BigInt(100) ? lo - BigInt(100) : BigInt(0),
    toBlock: lo + BigInt(100),
  });
  return logs[0]?.transactionHash ?? null;
}

async function findViaHintOrExplorer(
  client: PublicClient,
  licenseId: bigint,
  hint?: string | null,
): Promise<`0x${string}` | null> {
  if (hint && /^0x[0-9a-fA-F]{64}$/.test(hint)) {
    try {
      const receipt = await client.getTransactionReceipt({ hash: hint as `0x${string}` });
      const issued = parseEventLogs({ abi: SnippetLicensesAbi, logs: receipt.logs, eventName: "LicenseIssued" });
      if (
        issued.some(
          (e) =>
            e.args.licenseId === licenseId && e.address.toLowerCase() === SNIPPET_LICENSES_ADDRESS.toLowerCase(),
        )
      ) {
        return receipt.transactionHash;
      }
    } catch {
      // fall through to the explorer
    }
  }

  const params = new URLSearchParams({
    module: "logs",
    action: "getLogs",
    address: SNIPPET_LICENSES_ADDRESS,
    fromBlock: "0",
    toBlock: "latest",
    topic0: LICENSE_ISSUED_TOPIC,
    topic1: toHex(licenseId, { size: 32 }),
    topic0_1_opr: "and",
  });
  const res = await fetch(`${EXPLORER_API}?${params}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: { transactionHash?: `0x${string}` }[] };
  return json.result?.[0]?.transactionHash ?? null;
}

export interface SoldLicense {
  licenseId: bigint;
  buyer: `0x${string}`;
  useType: number;
  price: bigint;
  timestamp: bigint;
}

// Every license sold for one clip, oldest first. QuickNode Streams' license_events index first;
// if Supabase isn't configured or fails, read the contract directly.
export async function fetchClipLicenses(
  client: PublicClient,
  clipId: `0x${string}`,
): Promise<{ source: "streams" | "chain"; licenses: SoldLicense[] }> {
  if (streamsConfigured) {
    try {
      const events = await fetchLicenseEventsForClip(clipId);
      return {
        source: "streams",
        licenses: events.map((e) => ({
          licenseId: e.licenseId,
          buyer: e.buyer,
          useType: e.useType,
          price: e.price,
          timestamp: BigInt(Math.floor(e.blockTimestamp.getTime() / 1000)),
        })),
      };
    } catch (err) {
      console.warn("License list: Supabase unavailable, reading the contract instead", err);
    }
  }
  return { source: "chain", licenses: await fetchClipLicensesFromChain(client, clipId) };
}

export interface OwnedLicense extends SoldLicense {
  clipId: `0x${string}`;
  fileHash: `0x${string}`;
}

// Every license a wallet owns, newest first: license_events (QuickNode Streams) first, the contract as
// fallback when Supabase isn't configured or fails.
export async function fetchBuyerLicenses(
  client: PublicClient,
  buyer: `0x${string}`,
): Promise<{ source: "streams" | "chain"; licenses: OwnedLicense[] }> {
  if (streamsConfigured) {
    try {
      const events = await fetchLicenseEventsForBuyer(buyer);
      return {
        source: "streams",
        licenses: events.map((e) => ({
          licenseId: e.licenseId,
          clipId: e.clipId,
          fileHash: e.fileHash,
          buyer: e.buyer,
          useType: e.useType,
          price: e.price,
          timestamp: BigInt(Math.floor(e.blockTimestamp.getTime() / 1000)),
        })),
      };
    } catch (err) {
      console.warn("My Licenses: Supabase unavailable, reading the contract instead", err);
    }
  }
  const all = await fetchAllLicensesFromChain(client);
  return {
    source: "chain",
    licenses: all.filter((l) => l.buyer.toLowerCase() === buyer.toLowerCase()).reverse(),
  };
}

// Contract fallback: licenseCount, then getLicense for each id. Fine at demo scale.
const MAX_LICENSES_SCANNED = 500;

async function fetchClipLicensesFromChain(client: PublicClient, clipId: `0x${string}`): Promise<SoldLicense[]> {
  const all = await fetchAllLicensesFromChain(client);
  return all.filter((l) => l.clipId.toLowerCase() === clipId.toLowerCase());
}

// Oldest first.
async function fetchAllLicensesFromChain(client: PublicClient): Promise<OwnedLicense[]> {
  const count = await client.readContract({
    address: SNIPPET_LICENSES_ADDRESS,
    abi: SnippetLicensesAbi,
    functionName: "licenseCount",
  });
  const total = Number(count < BigInt(MAX_LICENSES_SCANNED) ? count : BigInt(MAX_LICENSES_SCANNED));
  const ids = Array.from({ length: total }, (_, i) => BigInt(i + 1));

  const all: OwnedLicense[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const batch = await Promise.all(
      ids.slice(i, i + 20).map((id) =>
        client.readContract({
          address: SNIPPET_LICENSES_ADDRESS,
          abi: SnippetLicensesAbi,
          functionName: "getLicense",
          args: [id],
        }),
      ),
    );
    batch.forEach((l, j) => {
      all.push({
        licenseId: ids[i + j],
        clipId: l.clipId,
        fileHash: l.fileHash,
        buyer: l.buyer,
        useType: l.useType,
        price: l.price,
        timestamp: l.timestamp,
      });
    });
  }
  return all;
}
