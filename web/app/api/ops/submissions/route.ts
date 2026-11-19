import { connection } from "next/server";
import { OPS_CACHE_HEADERS } from "@/lib/opsSales";
import { getOpsSubmissions } from "@/lib/opsSubmissions";

// GET /api/ops/submissions: the latest "Submit a clip" proposals with their issues against our listing
// rules, plus the rules, as JSON for the Snippet Ops Bot. Public and read only; cached at most 30 s.
export async function GET() {
  await connection();
  return Response.json(await getOpsSubmissions(), { headers: OPS_CACHE_HEADERS });
}
