export const TOKEN_CATEGORIES = [
  { id: "defi", label: "DeFi" },
  { id: "l2", label: "L2" },
  { id: "meme", label: "Memecoin" },
  { id: "stable", label: "Stablecoin" },
  { id: "gaming", label: "Gaming" },
  { id: "rwa", label: "RWA" },
] as const;

export type TokenCategoryId = (typeof TOKEN_CATEGORIES)[number]["id"];

// Curated tokens per category. Every symbol is verified to have a live Binance
// USDT pair, so prices always resolve. Selecting a category fetches these
// directly — which also surfaces memecoins that the default Trending pool
// deliberately filters out.
export const CATEGORY_SYMBOLS: Record<TokenCategoryId, string[]> = {
  defi: ["UNI", "AAVE", "MKR", "CRV", "LDO", "SNX", "COMP", "SUSHI", "CAKE", "RUNE", "INJ", "DYDX", "PENDLE", "JUP", "ENA", "MORPHO"],
  l2: ["ARB", "OP", "POL", "IMX", "STRK", "METIS", "MANTA", "ZK", "SCR"],
  meme: ["DOGE", "SHIB", "PEPE", "WIF", "BONK", "FLOKI", "BOME", "MEME", "NEIRO", "TURBO"],
  stable: ["USDC", "DAI", "FDUSD", "TUSD", "USDP"],
  gaming: ["GALA", "SAND", "MANA", "AXS", "APE", "BEAM", "PIXEL", "ACE", "GMT", "ENJ"],
  rwa: ["ONDO", "LINK", "PENDLE", "ENA", "OM", "OMNI", "POLYX", "CFG"],
};

/** Curated symbol list for a category (empty array if unknown). */
export function getCategorySymbols(id: TokenCategoryId): string[] {
  return CATEGORY_SYMBOLS[id] ?? [];
}
