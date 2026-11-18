import { formatUnits } from "viem";
import { USDC_DECIMALS } from "./arc";

// Prices as people read them: "$5", "$13.50". Testnet USDC is a dollar token. Prices a buyer pays name the
// currency ("$5 USDC", formatUsdc) so the Arc payment stays visible; splits and totals use plain dollars.
export function formatUsd(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/** Price with the currency named, for the places Arc judges should see it: "$5 USDC". */
export function formatUsdc(amount: number): string {
  return `${formatUsd(amount)} USDC`;
}

/** One line under the buy button: how the payment works on Arc. Two confirmations (approve + buy) cost
 * about 1¢ together; one costs under 1¢ (measured on Arc testnet at 25 gwei). */
export function arcPaymentLine(twoConfirmations: boolean): string {
  return `Paid in USDC on Arc · settles in about 0.5s · ${twoConfirmations ? "fees about 1¢" : "fee under 1¢"}`;
}

/** Same, from 6 decimal USDC units (contract amounts). */
export function formatUsdUnits(units: bigint): string {
  return formatUsd(Number(formatUnits(units, USDC_DECIMALS)));
}
