const STABLES = new Set(["USDC", "USDT", "DAI", "FRAX", "TUSD", "BUSD"]);
const MAJORS = new Set(["ETH", "WETH", "BTC", "WBTC"]);

/**
 * Returns auto-slippage in basis points based on the token pair type.
 * - Stable↔stable: 50 bps (0.5%)
 * - Either side is a major: 100 bps (1%)
 * - Long-tail: 300 bps (3%)
 */
export function defaultSlippageBps(
  fromSymbol: string | undefined,
  toSymbol: string | undefined,
): number {
  const from = (fromSymbol ?? "").toUpperCase();
  const to = (toSymbol ?? "").toUpperCase();
  if (STABLES.has(from) && STABLES.has(to)) return 50;
  if (MAJORS.has(from) || MAJORS.has(to)) return 100;
  return 300;
}
