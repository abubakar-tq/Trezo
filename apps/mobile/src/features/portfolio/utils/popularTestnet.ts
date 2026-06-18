// Network-aware "popular tokens" shelf data.
//
// Testnet:  ETH → buy (Transak), USDC/LINK → swap.
// Mainnet:  Richer list of LI.FI-routable tokens → swap; ETH → buy.

export type PopularAction = "buy" | "swap";
export type PopularToken = { symbol: string; action: PopularAction };

const BASE_MAINNET_POPULAR: PopularToken[] = [
  { symbol: "ETH",    action: "buy"  },
  { symbol: "USDC",   action: "swap" },
  { symbol: "WETH",   action: "swap" },
  { symbol: "DAI",    action: "swap" },
  { symbol: "USDT",   action: "swap" },
  { symbol: "AERO",   action: "swap" },
  { symbol: "cbETH",  action: "swap" },
  { symbol: "wstETH", action: "swap" },
  { symbol: "BRETT",  action: "swap" },
  { symbol: "DEGEN",  action: "swap" },
];

const ARB_MAINNET_POPULAR: PopularToken[] = [
  { symbol: "ETH",  action: "buy"  },
  { symbol: "USDC", action: "swap" },
  { symbol: "WETH", action: "swap" },
  { symbol: "ARB",  action: "swap" },
];

export function popularTokensForNetwork(networkKey: string): PopularToken[] {
  switch (networkKey) {
    case "base-mainnet":
    case "base-mainnet-fork":
      return BASE_MAINNET_POPULAR;
    case "arb-mainnet":
      return ARB_MAINNET_POPULAR;
    case "base-sepolia":
      return [
        { symbol: "ETH",  action: "buy"  },
        { symbol: "USDC", action: "swap" },
        { symbol: "LINK", action: "swap" },
      ];
    default:
      return [
        { symbol: "ETH",  action: "buy"  },
        { symbol: "USDC", action: "swap" },
      ];
  }
}

export function popularSectionLabel(networkKey: string): string {
  switch (networkKey) {
    case "base-mainnet":
    case "base-mainnet-fork":
      return "POPULAR ON BASE";
    case "arb-mainnet":
      return "POPULAR ON ARBITRUM";
    default:
      return "POPULAR ON TESTNET";
  }
}

/** @deprecated use popularTokensForNetwork */
export function popularTestnetTokens(networkKey: string): PopularToken[] {
  return popularTokensForNetwork(networkKey);
}
