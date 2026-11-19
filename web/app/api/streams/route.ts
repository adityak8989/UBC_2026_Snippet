import { createHmac, timingSafeEqual } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decodeEventLog } from "viem";
import { SnippetLicensesAbi } from "@/lib/abi";
import { SNIPPET_LICENSES_ADDRESS } from "@/lib/arc";
import { sendCreatorAlerts } from "@/lib/discord";

// QuickNode Streams webhook: Arc testnet logs -> license_events in Supabase.
//
// Security: QuickNode signs every delivery with the Stream's security token:
//   X-QN-Signature = hex(HMAC-SHA256(token, X-QN-Nonce + X-QN-Timestamp + body))
// Unsigned or wrongly signed requests get 401, and without a configured token nothing is accepted.
// Writes use SUPABASE_SECRET_KEY (server only; bypasses Row Level Security). Inserts on license_id with
// duplicates ignored (licenses are immutable on-chain facts), so a retried or replayed delivery changes
// nothing, and the rows that ARE new come back: those, and only those, get a Discord creator alert
// (lib/discord.ts), sent after the response so Discord can never slow down or fail the stream.
//
// Status codes drive QuickNode's retries: 2xx = done; 5xx = retry later (e.g. database unreachable).

const LICENSE_ISSUED_TOPIC = "0x019c42efa4a2ed077d7577fc401e2f0dfcf241fd5f419761e314dd00c73cfd8d";
const CONTRACT = SNIPPET_LICENSES_ADDRESS.toLowerCase();

interface RawLog {
  address?: string;
  topics?: string[];
  data?: string;
  blockNumber?: string | number;
  transactionHash?: string;
  logIndex?: string | number;
  removed?: boolean;
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "Snippet QuickNode Streams webhook", method: "POST" });
}

export async function POST(req: Request) {
  const token = process.env.QUICKNODE_STREAMS_SECURITY_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Streams webhook is not configured" }, { status: 503 });
  }

  // Raw bytes, decompressed if QuickNode sent gzip; the signature covers the uncompressed JSON.
  let raw = Buffer.from(await req.arrayBuffer());
  if (raw.length > 2 && raw[0] === 0x1f && raw[1] === 0x8b) raw = gunzipSync(raw);
  const body = raw.toString("utf8");

  if (!validSignature(req.headers, body, token)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Body is not JSON" }, { status: 400 });
  }

  // QuickNode nests logs differently depending on dataset and filter; collect every log object.
  const logs: RawLog[] = [];
  collectLogs(payload, logs);
  const ours = logs.filter(
    (l) =>
      !l.removed &&
      l.address?.toLowerCase() === CONTRACT &&
      l.topics?.[0]?.toLowerCase() === LICENSE_ISSUED_TOPIC,
  );

  const rows = [];
  for (const log of ours) {
    try {
      const { args } = decodeEventLog({
        abi: SnippetLicensesAbi,
        eventName: "LicenseIssued",
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        data: log.data as `0x${string}`,
      });
      rows.push({
        license_id: args.licenseId.toString(),
        clip_id: args.clipId.toLowerCase(),
        buyer: args.buyer.toLowerCase(),
        use_type: args.useType,
        price: args.price.toString(),
        rh_amount: args.rhAmount.toString(),
        contrib_amount: args.contribAmount.toString(),
        platform_amount: args.platformAmount.toString(),
        file_hash: args.fileHash.toLowerCase(),
        tx_hash: String(log.transactionHash).toLowerCase(),
        log_index: Number(BigInt(log.logIndex ?? 0)),
        block_number: BigInt(log.blockNumber ?? 0).toString(),
        // Logs carry no block time; the event records block.timestamp itself.
        block_timestamp: new Date(Number(args.timestamp) * 1000).toISOString(),
      });
    } catch (err) {
      console.warn("streams: could not decode a LicenseIssued log", log.transactionHash, err);
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ received: logs.length, upserted: 0 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    return NextResponse.json(
      { error: "Supabase is not configured", decoded: rows.map((r) => r.license_id) },
      { status: 503 },
    );
  }

  const supabase = createClient(url, secretKey, { auth: { persistSession: false } });
  const { data: inserted, error } = await supabase
    .from("license_events")
    .upsert(rows, { onConflict: "license_id", ignoreDuplicates: true })
    .select("license_id");
  if (error) {
    console.error("streams: upsert failed", error);
    return NextResponse.json({ error: "Database write failed" }, { status: 500 });
  }

  const newIds = new Set((inserted ?? []).map((r) => String(r.license_id)));
  const newRows = rows.filter((r) => newIds.has(r.license_id));
  if (newRows.length > 0) after(() => sendCreatorAlerts(newRows));

  return NextResponse.json({
    received: logs.length,
    upserted: rows.length,
    inserted: newRows.length,
    licenseIds: rows.map((r) => r.license_id),
  });
}

function validSignature(headers: Headers, body: string, token: string): boolean {
  const nonce = headers.get("x-qn-nonce");
  const timestamp = headers.get("x-qn-timestamp");
  const signature = headers.get("x-qn-signature");
  if (!nonce || !timestamp || !signature) return false;

  const expected = createHmac("sha256", token).update(nonce + timestamp + body).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function collectLogs(node: unknown, out: RawLog[], depth = 0): void {
  if (depth > 8 || node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectLogs(item, out, depth + 1);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.topics) && typeof obj.data === "string" && typeof obj.address === "string") {
    out.push(obj as RawLog);
    return;
  }
  for (const value of Object.values(obj)) collectLogs(value, out, depth + 1);
}
