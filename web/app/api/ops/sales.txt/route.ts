import { connection } from "next/server";
import { OPS_CACHE_HEADERS, getOpsSales, opsSalesText, parseSince } from "@/lib/opsSales";

// GET /api/ops/sales.txt[?since=<ISO time>]: the same feed as /api/ops/sales, one line per sale then
// today's summary, as plain text for a bot.
export async function GET(req: Request) {
  await connection();
  const since = parseSince(new URL(req.url).searchParams.get("since"));
  const headers = { ...OPS_CACHE_HEADERS, "content-type": "text/plain; charset=utf-8" };
  if (since === null) return new Response("since must be an ISO 8601 time\n", { status: 400, headers });
  try {
    return new Response(opsSalesText(await getOpsSales(since)), { headers });
  } catch {
    return new Response("Sales are unavailable right now\n", { status: 502, headers });
  }
}
