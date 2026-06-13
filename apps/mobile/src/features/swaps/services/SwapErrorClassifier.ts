// apps/mobile/src/features/swaps/services/SwapErrorClassifier.ts
export type SwapErrorKind =
  | "network"
  | "no_provider"
  | "insufficient_balance"
  | "insufficient_allowance"
  | "slippage_invalid"
  | "quote_stale"
  | "simulation_revert"
  | "user_rejected"
  | "bundler_error"
  | "unknown";

export interface ClassifiedError {
  kind: SwapErrorKind;
  userMessage: string;
  retryable: boolean;
  severity: "info" | "warning" | "error";
  source?: string;
}

const messageOf = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

export const classify = (err: unknown): ClassifiedError => {
  const m = messageOf(err);
  const lower = m.toLowerCase();

  if (lower.includes("user cancel") || lower.includes("cancelled passkey") || lower.includes("user_cancel")) {
    return { kind: "user_rejected", userMessage: "Cancelled. Try again whenever you're ready.", retryable: true, severity: "info" };
  }
  if (lower.includes("no swap provider")) {
    return { kind: "no_provider", userMessage: "No swap provider available for this chain or token pair.", retryable: false, severity: "error" };
  }
  if (lower.includes("slippage must be")) {
    return { kind: "slippage_invalid", userMessage: "Slippage must be between 0.01% and 50%.", retryable: false, severity: "error" };
  }
  if (lower.includes("insufficient sell token") || lower.includes("insufficient balance")) {
    return { kind: "insufficient_balance", userMessage: "Insufficient balance for this swap.", retryable: false, severity: "error" };
  }
  if (lower.includes("allowance") && lower.includes("insufficient")) {
    return { kind: "insufficient_allowance", userMessage: "Token approval needed before swapping.", retryable: true, severity: "error" };
  }
  if (lower.includes("quote is stale") || lower.includes("quote_stale") || lower.includes("price moved")) {
    return { kind: "quote_stale", userMessage: "Quote changed — review again.", retryable: true, severity: "warning" };
  }
  if (lower.includes("network error") || lower.includes("timeout") || lower.includes("fetch failed") || lower.includes("econnrefused") || lower.includes("etimedout")) {
    return { kind: "network", userMessage: "Network error. Check your connection and try again.", retryable: true, severity: "warning" };
  }
  if (lower.includes("useroperation") || lower.includes("bundler") || lower.includes("reverted")) {
    return { kind: "bundler_error", userMessage: m, retryable: false, severity: "error" };
  }
  return { kind: "unknown", userMessage: m || "Something went wrong.", retryable: false, severity: "error" };
};
