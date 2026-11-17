// Turns wallet and transaction errors into short, plain messages for the buy flow.
export interface FriendlyError {
  title: string;
  detail?: string;
}

export function friendlyTxError(error: unknown): FriendlyError {
  const err = error as { name?: string; code?: number; shortMessage?: string; message?: string; cause?: unknown };
  const text = collectText(error).toLowerCase();

  if (
    err.name === "UserRejectedRequestError" ||
    hasCode(error, 4001) ||
    text.includes("user rejected") ||
    text.includes("user denied") ||
    text.includes("rejected the request")
  ) {
    return { title: "You cancelled the request in your wallet.", detail: "Nothing was charged. Try again when you're ready." };
  }
  if (text.includes("insufficient") || text.includes("exceeds balance") || text.includes("transfer amount exceeds")) {
    return {
      title: "Not enough USDC for this purchase.",
      detail: "Add testnet USDC at faucet.circle.com (it also pays the small network fee), then try again.",
    };
  }
  if (err.name === "ChainMismatchError" || text.includes("does not match the target chain") || text.includes("chain mismatch")) {
    return { title: "Your wallet is on another network.", detail: "Switch to Arc Testnet and try again." };
  }
  return {
    title: "Something went wrong with the transaction.",
    detail: err.shortMessage ?? "Please try again. If it keeps happening, refresh the page.",
  };
}

function collectText(e: unknown, depth = 0): string {
  if (!e || typeof e !== "object" || depth > 5) return "";
  const { message, shortMessage, details, cause } = e as Record<string, unknown>;
  return [message, shortMessage, details].filter((s) => typeof s === "string").join(" ") + " " + collectText(cause, depth + 1);
}

function hasCode(e: unknown, code: number, depth = 0): boolean {
  if (!e || typeof e !== "object" || depth > 5) return false;
  const { code: c, cause } = e as { code?: unknown; cause?: unknown };
  return c === code || hasCode(cause, code, depth + 1);
}
