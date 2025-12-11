import { createPublicClient, createWalletClient, defineChain, http, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { CHAINS, DEFAULT_CHAIN_ID, type ChainConfig, type SupportedChainId } from "../chains";

const nativeCurrency = {
  name: "Ether",
  symbol: "ETH",
  decimals: 18,
};

const toViemChain = (config: ChainConfig): Chain =>
  defineChain({
    id: config.id,
    name: config.name,
    nativeCurrency,
    rpcUrls: {
      default: { http: [config.rpcUrl] },
      public: { http: [config.rpcUrl] },
    },
    testnet: ![1, 324].includes(config.id),
  });

const VIEM_CHAINS: Record<SupportedChainId, Chain> = {
  31337: toViemChain(CHAINS[31337]),
  11155111: toViemChain(CHAINS[11155111]),
  1: toViemChain(CHAINS[1]),
  324: toViemChain(CHAINS[324]),
  300: toViemChain(CHAINS[300]),
};

const requireRpcUrl = (chainId: SupportedChainId): string => {
  const url = CHAINS[chainId].rpcUrl;
  if (!url) {
    throw new Error(
      `RPC URL missing for chain ${chainId}. Set the EXPO_PUBLIC_* RPC env var before creating a viem client.`,
    );
  }
  return url;
};

export const getViemChain = (chainId: SupportedChainId = DEFAULT_CHAIN_ID): Chain => VIEM_CHAINS[chainId];

export const getPublicClient = (chainId: SupportedChainId = DEFAULT_CHAIN_ID) =>
  createPublicClient({
    chain: getViemChain(chainId),
    transport: http(requireRpcUrl(chainId)),
  });

export const getWalletClientFromPrivateKey = (
  privateKey: `0x${string}`,
  chainId: SupportedChainId = DEFAULT_CHAIN_ID,
) =>
  createWalletClient({
    chain: getViemChain(chainId),
    account: privateKeyToAccount(privateKey),
    transport: http(requireRpcUrl(chainId)),
  });
