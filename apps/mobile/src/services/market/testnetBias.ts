// Tokens listed by dex aggregators on Trezo's enabled testnets (Sepolia, Base Sepolia, Arb Sepolia, Anvil).
// Used as a SOFT bias for visible market entries (per docs/plans/App-improvements-brief.md Rule 1).
// Conservative initial set — refine in Phase 8 (Swap) after touching SwapQuoteService.
const TESTNET_TRADEABLE_SYMBOLS = new Set(["ETH", "USDC", "USDT", "DAI", "WETH", "WBTC"]);

export function biasToTestnetTradeable<T extends { symbol: string }>(assets: T[]): T[] {
  return [...assets].sort((a, b) => {
    const aT = TESTNET_TRADEABLE_SYMBOLS.has(a.symbol.toUpperCase()) ? 0 : 1;
    const bT = TESTNET_TRADEABLE_SYMBOLS.has(b.symbol.toUpperCase()) ? 0 : 1;
    return aT - bT;
  });
}

export function isTokenSwappableOnTestnet(symbol: string): boolean {
  return TESTNET_TRADEABLE_SYMBOLS.has(symbol.toUpperCase());
}
