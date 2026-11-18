import Link from "next/link";
import { formatUnits } from "viem";
import { USDC_DECIMALS } from "@/lib/arc";

export interface Payout {
  label: string; // "Host", "Guest", "Snippet"
  units: bigint; // USDC units (6 decimals) from the LicenseIssued event
}

interface Props {
  licenseId: bigint;
  priceUnits: bigint;
  useTypeLabel: string;
  payouts: Payout[];
  txHash: `0x${string}`;
  settledSeconds?: number; // wallet confirmation to receipt; unknown if the page was reloaded
  downloadUrl: string;
  downloadName: string;
}

const usdc = (units: bigint) => Number(formatUnits(units, USDC_DECIMALS)).toFixed(2);

// Shown after buyLicense confirms: the payment flowing to each payee, how fast Arc settled it,
// and links to the license certificate and the transaction.
export function PurchaseReceipt({
  licenseId,
  priceUnits,
  useTypeLabel,
  payouts,
  txHash,
  settledSeconds,
  downloadUrl,
  downloadName,
}: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-success/40 bg-success/5 p-4" role="status">
      <div className="flex items-start gap-3">
        <span className="receipt-pop flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success text-lg font-bold text-bg">
          ✓
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-bold">License #{licenseId.toString()} purchased</p>
          <p className="text-xs text-muted">
            You paid <span className="font-semibold text-ink">${usdc(priceUnits)} USDC</span> for a {useTypeLabel} license
          </p>
        </div>
      </div>

      {settledSeconds !== undefined && (
        <p className="font-display text-sm font-semibold text-success">
          Settled on Arc in {settledSeconds.toFixed(2)}s
        </p>
      )}

      {/* The payment splitting into one line per payee */}
      <ul className="flex flex-col gap-2.5" aria-label="Payment split">
        {payouts.map((p, i) => (
          <li key={p.label} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-xs">
            <span className="font-medium text-muted">{p.label}</span>
            <span className="relative h-1.5 overflow-hidden rounded-full bg-line">
              <span
                className="receipt-fill absolute inset-y-0 left-0 rounded-full bg-success"
                style={{ animationDelay: `${i * 220}ms` }}
              />
              <span
                className="receipt-dot absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-ink"
                style={{ animationDelay: `${i * 220}ms` }}
              />
            </span>
            <span
              className="receipt-amount font-mono font-semibold text-ink"
              style={{ animationDelay: `${i * 220 + 600}ms` }}
            >
              ${usdc(p.units)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <Link
          href={`/license/${licenseId.toString()}?tx=${txHash}`}
          className="rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white hover:opacity-90"
        >
          View your license
        </Link>
        <a
          href={downloadUrl}
          download={downloadName}
          className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-center text-sm font-semibold text-ink hover:border-muted/60"
        >
          ⬇ Download Master Video (.mp4)
        </a>
        <a
          href={`https://testnet.arcscan.app/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="text-center text-xs text-muted underline hover:text-ink"
        >
          View transaction on ArcScan ↗
        </a>
      </div>
    </div>
  );
}
