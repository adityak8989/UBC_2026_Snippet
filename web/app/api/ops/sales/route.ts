import { connection } from "next/server";
import { OPS_CACHE_HEADERS, getOpsSales, parseSince } from "@/lib/opsSales";

// GET /api/ops/sales[?since=<ISO time>]: the last 50 sales and today's earnings per creator, as JSON, for
// the Snippet Ops Bot (lib/opsSales.ts). Public and read only; cached by the CDN for at most 30 s.
export async function GET(req: Request) {
  await connection();
  const since = parseSince(new URL(req.url).searchParams.get("since"));
  if (since === null) return Response.json({ error: "since must be an ISO 8601 time" }, { status: 400 });
  try {
    return Response.json(await getOpsSales(since), { headers: OPS_CACHE_HEADERS });
  } catch {
    return Response.json({ error: "Sales are unavailable right now" }, { status: 502 });
  }
}
