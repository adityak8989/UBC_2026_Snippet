import "server-only";
import { createPublicClient, http, zeroAddress, type PublicClient } from "viem";
import { SnippetLicensesAbi } from "./abi";
import { SNIPPET_LICENSES_ADDRESS } from "./arc";

// Server side Arc reads for license verification (Check License, certificates, the certificate preview
// image). Primary: our QuickNode Arc testnet endpoint (QUICKNODE_ARC_RPC_URL, a server only secret: never
// NEXT_PUBLIC_, never logged or sent to the browser). Fallback: the public Arc RPC if QuickNode is
// missing, slow or errors. Responses say which one answered ("quicknode" / "public"), never the URL.

const PUBLIC_ARC_RPC = "https://rpc.testnet.arc.network";

export type RpcSource = "quicknode" | "public";

let quicknode: PublicClient | null | undefined;
let publicRpc: PublicClient | undefined;

function quicknodeClient(): PublicClient | null {
  if (quicknode === undefined) {
    const url = process.env.QUICKNODE_ARC_RPC_URL;
    quicknode = url ? createPublicClient({ transport: http(url, { timeout: 6_000, retryCount: 1 }) }) : null;
  }
  return quicknode;
}

function publicClient(): PublicClient {
  publicRpc ??= createPublicClient({ transport: http(PUBLIC_ARC_RPC, { timeout: 10_000, retryCount: 2 }) });
  return publicRpc;
}

/** Runs a read on QuickNode, then on the public Arc RPC if that fails. */
export async function readArc<T>(read: (client: PublicClient) => Promise<T>): Promise<{ value: T; via: RpcSource }> {
  const qn = quicknodeClient();
  if (qn) {
    try {
      return { value: await read(qn), via: "quicknode" };
    } catch (err) {
      // Log the failure kind only; the error text could contain the endpoint URL.
      console.warn("QuickNode RPC failed, falling back to the public Arc RPC:", (err as Error)?.name ?? "error");
    }
  }
  return { value: await read(publicClient()), via: "public" };
}

export async function getLicenseOnChain(licenseId: bigint) {
  const { value, via } = await readArc((c) =>
    c.readContract({ address: SNIPPET_LICENSES_ADDRESS, abi: SnippetLicensesAbi, functionName: "getLicense", args: [licenseId] }),
  );
  return { license: value.buyer === zeroAddress ? null : value, via };
}

export async function getClipsOnChain(clipIds: `0x${string}`[]) {
  return readArc((c) =>
    Promise.all(
      clipIds.map((clipId) =>
        c.readContract({ address: SNIPPET_LICENSES_ADDRESS, abi: SnippetLicensesAbi, functionName: "getClip", args: [clipId] }),
      ),
    ),
  );
}
