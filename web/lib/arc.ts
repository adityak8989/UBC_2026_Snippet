import { defineChain } from "viem";

// Arc testnet: Circle's EVM L1, where USDC is the gas token.
//
// DECIMALS WARNING: Arc has two views of the same USDC:
//   - the NATIVE gas balance uses 18 decimals (that is what `nativeCurrency` below describes,
//     and what wallets show as the account balance), and
//   - the USDC ERC-20 interface at USDC_ADDRESS uses 6 decimals.
// This app must only read balances, approve, and pay through the 6-decimal ERC-20 interface.
// Never use the native balance (e.g. wagmi's useBalance without a `token`) for prices or payments.

export const ARC_TESTNET_CHAIN_ID = 5042002;

// Read from .env.local. NEXT_PUBLIC_ variables are bundled into the browser code,
// so only put an RPC URL here that is safe to expose (public RPC, or a domain-restricted key).
const rpcUrl = process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL ?? "";

if (!rpcUrl) {
  console.warn("NEXT_PUBLIC_ARC_TESTNET_RPC_URL is not set; chain reads and transactions will fail.");
}

export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  testnet: true,
});

// USDC ERC-20 interface on Arc testnet. 6 decimals: 1 USDC = 1_000_000 units.
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;
export const USDC_DECIMALS = 6;

// SnippetLicenses contract address (configured in .env after deployment)
export const SNIPPET_LICENSES_ADDRESS = (process.env.NEXT_PUBLIC_SNIPPET_LICENSES_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;

