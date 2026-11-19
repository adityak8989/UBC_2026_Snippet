import "server-only";
import { formatUnits } from "viem";
import { USDC_DECIMALS } from "./arc";
import { DEMO_CLIPS } from "./clips";
import { getCreator } from "./creators";
import { EXPLORER_URL, USE_TYPE_NAMES } from "./licenses";

// Automated creator alerts: when the QuickNode Streams webhook stores a NEW license, post who earned what
// to a Discord channel. DISCORD_WEBHOOK_URL is a server only secret (never NEXT_PUBLIC_, never logged).
// Alerts never affect the stream: failures are logged (without the URL) and the webhook still answers 2xx.

const SITE_URL = "https://snippet-gamma.vercel.app";

export interface NewLicenseRow {
  license_id: string;
  clip_id: string;
  use_type: number;
  rh_amount: string;
  contrib_amount: string;
  tx_hash: string;
}

const dollars = (units: string) => `$${Number(formatUnits(BigInt(units), USDC_DECIMALS)).toFixed(2)}`;

/** "💸 SpaceLofi just earned $3.50 and Esteban (producer) earned $1.00 from Clipping on the Blockchain (Editorial license) · Verified on Arc" */
export function creatorAlertMessage(row: NewLicenseRow): string {
  const clip = DEMO_CLIPS.find((c) => c.clipIdBytes32.toLowerCase() === row.clip_id.toLowerCase());
  const creator = getCreator(clip)?.name ?? "The creator";
  const useType = USE_TYPE_NAMES[row.use_type] ?? "a";
  const hasContributor = BigInt(row.contrib_amount) > BigInt(0);
  const contributor = clip?.contributorName && clip.creator ? clip.contributorName : "the contributor";
  const earned = hasContributor
    ? `${creator} just earned ${dollars(row.rh_amount)} and ${contributor} earned ${dollars(row.contrib_amount)}`
    : `${creator} just earned ${dollars(row.rh_amount)}`;
  return [
    `💸 ${earned} from **${clip?.title ?? "a Snippet clip"}** (${useType} license) · Verified on Arc`,
    `[License #${row.license_id}](${SITE_URL}/license/${row.license_id}) · [Transaction on ArcScan](${EXPLORER_URL}/tx/${row.tx_hash})`,
  ].join("\n");
}

/** Posts one plain message (used by the signed alert test). Returns Discord's HTTP status; never throws. */
export async function sendDiscordTest(content: string): Promise<{ sent: boolean; status?: number; reason?: string }> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return { sent: false, reason: "DISCORD_WEBHOOK_URL is not set" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(5_000),
    });
    return { sent: res.ok, status: res.status };
  } catch (err) {
    return { sent: false, reason: (err as Error)?.name ?? "error" };
  }
}

/** Posts one Discord message per new license. Never throws. */
export async function sendCreatorAlerts(rows: NewLicenseRow[]): Promise<void> {
  if (rows.length === 0) return;
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.warn(`discord: DISCORD_WEBHOOK_URL is not set; skipped ${rows.length} creator alert(s)`);
    return;
  }
  for (const row of rows) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: creatorAlertMessage(row),
          allowed_mentions: { parse: [] }, // never ping anyone
          flags: 4, // SUPPRESS_EMBEDS: keep it to the one line plus links
        }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) console.warn(`discord: alert for license #${row.license_id} failed with HTTP ${res.status}`);
    } catch (err) {
      console.warn(`discord: alert for license #${row.license_id} failed:`, (err as Error)?.name ?? "error");
    }
  }
}
