import { parseEventLogs, toHex, type PublicClient } from "viem";
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
