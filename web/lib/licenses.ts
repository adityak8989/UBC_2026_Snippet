import { decodeEventLog, parseEventLogs, toHex, type PublicClient } from "viem";
import { SnippetLicensesAbi } from "./abi";
import { SNIPPET_LICENSES_ADDRESS } from "./arc";

export const EXPLORER_URL = "https://testnet.arcscan.app";
// Blockscout API behind testnet.arcscan.app (allows cross origin requests).
const EXPLORER_API = "https://explorer.testnet.arc.io/api";

export const USE_TYPE_NAMES = ["Editorial", "Social", "Commercial"] as const;

// keccak256("LicenseIssued(uint256,bytes32,address,bytes32,uint8,uint256,uint256,uint256,uint256,uint64)")
const LICENSE_ISSUED_TOPIC = "0x019c42efa4a2ed077d7577fc401e2f0dfcf241fd5f419761e314dd00c73cfd8d";

// Finds the transaction that issued a license. Uses the tx hash from the receipt link when it really
// issued this license; otherwise asks the explorer, because the public RPC can't search old blocks.
export async function findLicenseTx(
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

// Every license sold for one clip, oldest first, from the explorer's index of LicenseIssued events.
export async function fetchClipLicenses(clipId: `0x${string}`): Promise<SoldLicense[]> {
  const params = new URLSearchParams({
    module: "logs",
    action: "getLogs",
    address: SNIPPET_LICENSES_ADDRESS,
    fromBlock: "0",
    toBlock: "latest",
    topic0: LICENSE_ISSUED_TOPIC,
    topic2: clipId,
    topic0_2_opr: "and",
  });
  const res = await fetch(`${EXPLORER_API}?${params}`);
  if (!res.ok) throw new Error(`Explorer returned ${res.status}`);
  const json = (await res.json()) as { result?: { topics: (`0x${string}` | null)[]; data: `0x${string}` }[] | string };
  if (!Array.isArray(json.result)) return [];
  return json.result
    .map((log) => {
      const { args } = decodeEventLog({
        abi: SnippetLicensesAbi,
        eventName: "LicenseIssued",
        topics: log.topics.filter((t): t is `0x${string}` => !!t) as [`0x${string}`, ...`0x${string}`[]],
        data: log.data,
      });
      return {
        licenseId: args.licenseId,
        buyer: args.buyer,
        useType: args.useType,
        price: args.price,
        timestamp: args.timestamp,
      };
    })
    .sort((a, b) => (a.licenseId < b.licenseId ? -1 : 1));
}
