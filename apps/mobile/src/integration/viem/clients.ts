/**
 * clients.ts
 *
 * Viem public/wallet client factories.
 *
 * New API (network-key aware):
 *   getViemChainForNetwork(networkKey)
 *   getPublicClientForNetwork(networkKey)
 *   getWalletClientFromPrivateKeyForNetwork(privateKey, networkKey)
 *
 * Legacy API (backwards-compat, chain-id based):
 *   getViemChain(chainId)
 *   getPublicClient(chainId)
 *   getWalletClientFromPrivateKey(privateKey, chainId)
 */

import { createPublicClient, createWalletClient, defineChain, http, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { CHAINS, DEFAULT_CHAIN_ID, getChainConfig, type ChainConfig, type SupportedChainId } from "../chains";
import { type NetworkConfig, type NetworkKey, getNetworkConfig, getRpcUrlForNetwork } from "../networks";

// ─── Internal helpers ─────────────────────────────────────────────────────────

const chainConfigToViemChain = (config: ChainConfig): Chain =>
  defineChain({
    id: config.id,
    name: config.name,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: {
      default: { http: [config.rpcUrl] },
      public: { http: [config.rpcUrl] },
    },
    testnet: config.environment !== "mainnet",
  });

const networkConfigToViemChain = (config: NetworkConfig): Chain =>
  defineChain({
    id: config.chainId,
    name: config.name,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: {
      default: { http: [config.rpcUrl] },
      public: { http: [config.rpcUrl] },
    },
    testnet: config.environment !== "mainnet",
  });

// ─── Legacy chain-id helpers ──────────────────────────────────────────────────

const VIEM_CHAINS: Record<SupportedChainId, Chain> = {
  31337: chainConfigToViemChain(CHAINS[31337]),
  11155111: chainConfigToViemChain(CHAINS[11155111]),
  1: chainConfigToViemChain(CHAINS[1]),
  324: chainConfigToViemChain(CHAINS[324]),
  300: chainConfigToViemChain(CHAINS[300]),
  8453: chainConfigToViemChain(CHAINS[8453]),
};

const requireLegacyRpcUrl = (chainId: SupportedChainId): string => {
  const chain = getChainConfig(chainId);
  if (!chain.isEnabled) {
    throw new Error(`Chain ${chain.name} (${chainId}) is disabled.`);
  }
  const url = chain.rpcUrl;
  if (!url) {
    throw new Error(
      `RPC URL missing for chain ${chainId}. Set the EXPO_PUBLIC_* RPC env var before creating a viem client.`
    );
  }
  return url;
};

/** @deprecated Prefer getViemChainForNetwork(networkKey). */
export const getViemChain = (chainId: SupportedChainId = DEFAULT_CHAIN_ID): Chain =>
  VIEM_CHAINS[chainId];

/** @deprecated Prefer getPublicClientForNetwork(networkKey). */
export const getPublicClient = (chainId: SupportedChainId = DEFAULT_CHAIN_ID) =>
  createPublicClient({
    chain: getViemChain(chainId),
    transport: http(requireLegacyRpcUrl(chainId)),
  });

/** @deprecated Prefer getWalletClientFromPrivateKeyForNetwork(key, networkKey). */
export const getWalletClientFromPrivateKey = (
  privateKey: `0x${string}`,
  chainId: SupportedChainId = DEFAULT_CHAIN_ID
) =>
  createWalletClient({
    chain: getViemChain(chainId),
    account: privateKeyToAccount(privateKey),
    transport: http(requireLegacyRpcUrl(chainId)),
  });

// ─── Network-key-aware helpers ────────────────────────────────────────────────

/** Returns a viem Chain definition for the given networkKey. */
export const getViemChainForNetwork = (networkKey: NetworkKey): Chain => {
  const config = getNetworkConfig(networkKey);
  return networkConfigToViemChain(config);
};

/** Returns a viem PublicClient for the given networkKey. */
export const getPublicClientForNetwork = (networkKey: NetworkKey) => {
  const rpcUrl = getRpcUrlForNetwork(networkKey);
  const chain = getViemChainForNetwork(networkKey);
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
};

/** Returns a viem WalletClient backed by an in-memory private key, for the given networkKey. */
export const getWalletClientFromPrivateKeyForNetwork = (
  privateKey: `0x${string}`,
  networkKey: NetworkKey
) => {
  const rpcUrl = getRpcUrlForNetwork(networkKey);
  const chain = getViemChainForNetwork(networkKey);
  return createWalletClient({
    chain,
    account: privateKeyToAccount(privateKey),
    transport: http(rpcUrl),
  });
};
