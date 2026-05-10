// Editorial list — no DappRadar dependency per brief §3.2.
export const TRENDING_SITES = [
  { id: "uniswap", name: "Uniswap", url: "https://app.uniswap.org", category: "DEX" },
  { id: "aave", name: "Aave", url: "https://app.aave.com", category: "Lending" },
  { id: "opensea", name: "OpenSea", url: "https://opensea.io", category: "NFT" },
  { id: "lido", name: "Lido", url: "https://lido.fi", category: "Staking" },
  { id: "oneinch", name: "1inch", url: "https://app.1inch.io", category: "DEX" },
  { id: "ens", name: "ENS", url: "https://app.ens.domains", category: "Identity" },
] as const;

export type TrendingSite = (typeof TRENDING_SITES)[number];
