import { connection } from "next/server";
import { DEMO_CLIPS } from "@/lib/clips";
import { getClipsOnChain } from "@/lib/serverChain";

// GET /api/chain/clips: every clip in clips.json as registered on the SnippetLicenses contract (listed,
// active, file hash, rights holder), read on the server through QuickNode (public Arc RPC fallback).
// Used by Check License to match a dropped file's fingerprint. Same order as DEMO_CLIPS.
export async function GET() {
  await connection();
  try {
    const { value, via } = await getClipsOnChain(DEMO_CLIPS.map((c) => c.clipIdBytes32));
    const clips = value.map((c, i) => ({
      id: DEMO_CLIPS[i].id,
      listed: c.listed,
      active: c.active,
      fileHash: c.fileHash,
      rightsHolder: c.rightsHolder,
    }));
    return Response.json({ clips, via }, { headers: { "x-snippet-rpc": via, "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Arc is unreachable right now" }, { status: 502 });
  }
}
