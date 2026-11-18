import { formatUnits } from "viem";
import { USDC_DECIMALS } from "./arc";

// Prices as people read them: "$5", "$13.50". Testnet USDC is a dollar token, so the UI says dollars and
// keeps "USDC" out of sight.
export function formatUsd(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/** Same, from 6 decimal USDC units (contract amounts). */
export function formatUsdUnits(units: bigint): string {
  return formatUsd(Number(formatUnits(units, USDC_DECIMALS)));
}
