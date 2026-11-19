import { connection } from "next/server";
import { OPS_CACHE_HEADERS } from "@/lib/opsSales";
import { getOpsSubmissions, opsSubmissionsText } from "@/lib/opsSubmissions";

// GET /api/ops/submissions.txt: the listing rules, then one line per submission, as plain text for a bot.
export async function GET() {
  await connection();
  return new Response(opsSubmissionsText(await getOpsSubmissions()), {
    headers: { ...OPS_CACHE_HEADERS, "content-type": "text/plain; charset=utf-8" },
  });
}
