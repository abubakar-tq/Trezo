// Mirrors apps/mobile/src/integration/networks.ts NetworkKey values.
export const CHAIN_ID_TO_NETWORK_KEY: Record<number, string> = {
  31337: "anvil-local",
  8453: "base-mainnet-fork",
  84532: "base-sepolia",
  11155111: "ethereum-sepolia",
  421614: "arbitrum-sepolia",
};

export function networkKeyForChain(chainId: number): string | null {
  return CHAIN_ID_TO_NETWORK_KEY[chainId] ?? null;
}
