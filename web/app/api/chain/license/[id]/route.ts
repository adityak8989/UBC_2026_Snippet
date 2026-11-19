import { connection } from "next/server";
import { getLicenseOnChain } from "@/lib/serverChain";

// GET /api/chain/license/[id]: the license as recorded by the SnippetLicenses contract, read on the server
// through QuickNode (public Arc RPC fallback). Used by the certificate to verify what it shows.
// { license: {...} | null, via: "quicknode" | "public" }; amounts and timestamps are decimal strings.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection(); // always read the chain at request time
  const { id } = await params;
  if (!/^\d{1,18}$/.test(id) || id === "0") return Response.json({ error: "invalid license id" }, { status: 400 });
  try {
    const { license, via } = await getLicenseOnChain(BigInt(id));
    const body = {
      license: license && {
        clipId: license.clipId,
        fileHash: license.fileHash,
        buyer: license.buyer,
        useType: license.useType,
        timestamp: license.timestamp.toString(),
        price: license.price.toString(),
        rhAmount: license.rhAmount.toString(),
        contribAmount: license.contribAmount.toString(),
        platformAmount: license.platformAmount.toString(),
      },
      via,
    };
    return Response.json(body, { headers: { "x-snippet-rpc": via, "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Arc is unreachable right now" }, { status: 502 });
  }
}
