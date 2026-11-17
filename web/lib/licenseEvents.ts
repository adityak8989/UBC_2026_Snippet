import { supabase } from "./supabase";

// A row of license_events (filled by QuickNode Streams via /api/streams), in app types.
export interface LicenseEvent {
  licenseId: bigint;
  clipId: `0x${string}`;
  buyer: `0x${string}`;
  useType: number;
  price: bigint;
  rhAmount: bigint;
  contribAmount: bigint;
  platformAmount: bigint;
  fileHash: `0x${string}`;
  txHash: `0x${string}`;
  blockNumber: bigint;
  blockTimestamp: Date;
}

interface Row {
  license_id: number | string;
  clip_id: string;
  buyer: string;
  use_type: number;
  price: number | string;
  rh_amount: number | string;
  contrib_amount: number | string;
  platform_amount: number | string;
  file_hash: string;
  tx_hash: string;
  block_number: number | string;
  block_timestamp: string;
}

const COLUMNS =
  "license_id, clip_id, buyer, use_type, price, rh_amount, contrib_amount, platform_amount, file_hash, tx_hash, block_number, block_timestamp";

function fromRow(r: Row): LicenseEvent {
  return {
    licenseId: BigInt(r.license_id),
    clipId: r.clip_id as `0x${string}`,
    buyer: r.buyer as `0x${string}`,
    useType: r.use_type,
    price: BigInt(r.price),
    rhAmount: BigInt(r.rh_amount),
    contribAmount: BigInt(r.contrib_amount),
    platformAmount: BigInt(r.platform_amount),
    fileHash: r.file_hash as `0x${string}`,
    txHash: r.tx_hash as `0x${string}`,
    blockNumber: BigInt(r.block_number),
    blockTimestamp: new Date(r.block_timestamp),
  };
}

export const streamsConfigured = supabase !== null;

function client() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

// Newest first. Throws if Supabase is not configured or the query fails, so callers can fall back.
export async function fetchLicenseEvents(limit = 1000): Promise<LicenseEvent[]> {
  const { data, error } = await client()
    .from("license_events")
    .select(COLUMNS)
    .order("license_id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function fetchLicenseEvent(licenseId: bigint): Promise<LicenseEvent | null> {
  const { data, error } = await client()
    .from("license_events")
    .select(COLUMNS)
    .eq("license_id", licenseId.toString())
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : null;
}

export async function fetchLicenseEventsForClip(clipId: string): Promise<LicenseEvent[]> {
  const { data, error } = await client()
    .from("license_events")
    .select(COLUMNS)
    .eq("clip_id", clipId.toLowerCase())
    .order("license_id", { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

// Calls onChange whenever a license_events row is inserted or updated (Supabase Realtime).
// Returns an unsubscribe function. No-op without Supabase.
export function subscribeLicenseEvents(onChange: () => void): () => void {
  if (!supabase) return () => {};
  const sb = supabase;
  const channel = sb
    .channel("license_events_feed")
    .on("postgres_changes", { event: "*", schema: "public", table: "license_events" }, () => onChange())
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}
