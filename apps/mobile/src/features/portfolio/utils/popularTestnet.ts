// Pure helper: registry-tradeable coins on testnet, chain-aware.
//
// ETH  → "buy"  (Transak ETH-only, always available).
// USDC → "swap" (always available).
// LINK → "swap" (base-sepolia only — it has a real pool there).
//
// Kept pure (no react-native imports) so it is testable via npx tsx.

export type PopularAction = "buy" | "swap";
export type PopularToken = { symbol: string; action: PopularAction };

/**
 * Registry-tradeable coins per testnet (chain-aware).
 * ETH → Buy (Transak ETH-only); USDC/LINK → Swap.
 * LINK is base-sepolia only.
 */
export function popularTestnetTokens(networkKey: string): PopularToken[] {
  const tokens: PopularToken[] = [
    { symbol: "ETH", action: "buy" },
    { symbol: "USDC", action: "swap" },
  ];

  if (networkKey === "base-sepolia") {
    tokens.push({ symbol: "LINK", action: "swap" });
  }

  return tokens;
}
