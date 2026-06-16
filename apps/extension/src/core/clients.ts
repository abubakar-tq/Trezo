import { createPublicClient, defineChain, http, type Chain } from "viem";
import { getNetwork } from "./networks";

const chainCache = new Map<number, Chain>();
export const getViemChain = (chainId: number): Chain => {
  if (chainCache.has(chainId)) return chainCache.get(chainId)!;
  const n = getNetwork(chainId);
  const c = defineChain({
    id: n.chainId, name: n.name,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [n.rpcUrl] }, public: { http: [n.rpcUrl] } },
    testnet: true,
  });
  chainCache.set(chainId, c);
  return c;
};
export const getPublicClient = (chainId: number) =>
  createPublicClient({ chain: getViemChain(chainId), transport: http(getNetwork(chainId).rpcUrl, { timeout: 60_000 }) });
