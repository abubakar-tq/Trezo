/**
 * Pure formatting helpers for transaction rows and detail screen.
 * No React-Native imports — safe for unit tests via `npx tsx`.
 */

import type { WalletTransactionDirection, WalletTransactionType } from "../types/transaction";

/** Human-readable primary label for a transaction row. */
export function txRowLabel(
  direction: WalletTransactionDirection,
  type: WalletTransactionType,
  symbol: string | null,
): string {
  const sym = symbol ?? "";
  switch (type) {
    case "send_native":
    case "send_erc20":
      return direction === "incoming"
        ? `Received${sym ? ` ${sym}` : ""}`
        : `Sent${sym ? ` ${sym}` : ""}`;
    case "swap":
      return "Swapped";
    case "cross_chain_swap":
      return "Cross-chain Swap";
    case "bridge":
      return "Bridged";
    case "token_approval":
      return "Approved";
    case "module_install":
      return "Module Install";
    case "recovery":
      return "Recovery";
    case "contract_interaction":
      return direction === "incoming"
        ? `Received${sym ? ` ${sym}` : ""}`
        : "Contract Call";
    default: {
      // fallback: title-case the snake_case type
      const t: string = type;
      return t.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
}

/**
 * Format gas fee from gasUsed + effectiveGasPriceWei strings (both are numeric strings).
 * Returns a human-readable ETH amount string, or null if inputs are unavailable/invalid.
 */
export function formatGasFee(
  gasUsed: string | null,
  effectiveGasPriceWei: string | null,
): string | null {
  if (!gasUsed || !effectiveGasPriceWei) return null;
  try {
    const feeWei = BigInt(gasUsed) * BigInt(effectiveGasPriceWei);
    // Manual formatEther — avoid requiring viem in plain test context
    const divisor = 10n ** 18n;
    const whole = feeWei / divisor;
    const frac = feeWei % divisor;
    const fracStr = frac.toString().padStart(18, "0").slice(0, 6).replace(/0+$/, "");
    return fracStr ? `${whole}.${fracStr}` : `${whole}`;
  } catch {
    return null;
  }
}
