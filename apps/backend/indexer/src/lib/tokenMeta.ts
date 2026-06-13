import { erc20Abi, getAddress, type Address } from "viem";

export interface TokenMeta { symbol: string; decimals: number; }

// Known tokens per chain (mirror of mobile tokenRegistry for the chains we index).
const KNOWN: Record<number, Record<string, TokenMeta>> = {
  84532: { // Base Sepolia
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e": { symbol: "USDC", decimals: 6 },
    "0x4200000000000000000000000000000000000006": { symbol: "WETH", decimals: 18 },
    "0xE4aB69C077896252FAFBD49EFD26B5D171A32410": { symbol: "LINK", decimals: 18 },
  },
  11155111: { // Ethereum Sepolia
    "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238": { symbol: "USDC", decimals: 6 },
    "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14": { symbol: "WETH", decimals: 18 },
  },
  421614: { // Arbitrum Sepolia
    "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d": { symbol: "USDC", decimals: 6 },
    "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73": { symbol: "WETH", decimals: 18 },
  },
};

const cache = new Map<string, TokenMeta>();

// `client` is Ponder's context.client (a viem PublicClient).
export async function resolveTokenMeta(
  chainId: number,
  tokenAddress: string,
  client: { readContract: (args: any) => Promise<any> },
): Promise<TokenMeta> {
  const key = `${chainId}:${tokenAddress.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const checksum = getAddress(tokenAddress) as Address;
  const known = KNOWN[chainId]?.[checksum];
  if (known) { cache.set(key, known); return known; }

  // Fallback: read symbol()/decimals() on-chain. Default to a safe value on failure.
  let symbol = "TOKEN";
  let decimals = 18;
  try {
    decimals = Number(await client.readContract({ abi: erc20Abi, address: checksum, functionName: "decimals" }));
  } catch { /* keep default */ }
  try {
    symbol = String(await client.readContract({ abi: erc20Abi, address: checksum, functionName: "symbol" }));
  } catch { /* keep default */ }

  const meta = { symbol, decimals };
  cache.set(key, meta);
  return meta;
}
