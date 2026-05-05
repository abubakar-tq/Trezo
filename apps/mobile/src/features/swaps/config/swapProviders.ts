/**
 * swapProviders.ts
 *
 * Provider registry and trusted-spender helpers.
 *
 * New API (network-key aware):
 *   getSwapProvidersForNetwork(networkKey)
 *   getTrustedSpendersForNetwork(networkKey)  — from dexRegistry
 *   isTrustedSpenderForNetwork(networkKey, spender)
 *
 * Legacy API (chain-id based):
 *   getSwapProvidersForChain(chainId)
 *   isTrustedSpenderForChain(chainId, spender)
 */

import type { SwapRouteProvider } from "@/src/features/swaps/providers/SwapRouteProvider";
import { LocalMockSwapProvider } from "@/src/features/swaps/providers/LocalMockSwapProvider";
import { DirectUniswapV3ForkProvider } from "@/src/features/swaps/providers/DirectUniswapV3ForkProvider";
import { UniswapV2BaseProvider } from "@/src/features/swaps/providers/UniswapV2BaseProvider";
import type { SupportedChainId } from "@/src/integration/chains";
import type { NetworkKey } from "@/src/integration/networks";
import { getDeployment } from "@/src/integration/viem/deployments";
import {
  getTrustedSpendersForNetwork as getDexTrustedSpenders,
  isTrustedSpenderForNetwork as isDexTrustedSpender,
} from "@/src/features/swaps/config/dexRegistry";
import type { Address } from "viem";

// ─── Provider instances ────────────────────────────────────────────────────────

const legacyProviders: readonly SwapRouteProvider[] = [
  new LocalMockSwapProvider(),
];

const forkProviders: readonly SwapRouteProvider[] = [
  // V2 first: getAmountsOut is a pure view call — faster and more reliable on remote RPCs
  new UniswapV2BaseProvider(),
  // V3 fallback: higher precision quotes via QuoterV2 simulation
  new DirectUniswapV3ForkProvider(),
];

// ─── Network-key-aware API ─────────────────────────────────────────────────────

export const getSwapProvidersForNetwork = (networkKey: NetworkKey): SwapRouteProvider[] => {
  if (networkKey === "base-mainnet-fork" || networkKey === "base-mainnet") {
    return [...forkProviders];
  }
  // Fallback to legacy for anvil-local and other networks
  return legacyProviders.filter((p) => {
    // LocalMockSwapProvider only supports chain 31337
    return (p as LocalMockSwapProvider).supportsChain?.(31337) ?? false;
  });
};

export const isTrustedSpenderForNetwork = (networkKey: NetworkKey, spender: Address): boolean =>
  isDexTrustedSpender(networkKey, spender);

// ─── Legacy chain-id API (backwards compat) ────────────────────────────────────

export const getSwapProvidersForChain = (chainId: SupportedChainId): SwapRouteProvider[] =>
  legacyProviders.filter((provider) => provider.supportsChain(chainId));

export const getTrustedSpendersForChain = (chainId: SupportedChainId): Address[] => {
  const deployment = getDeployment(chainId as never);
  const trusted: Address[] = [];

  if (deployment?.mockSwapRouter) {
    trusted.push(deployment.mockSwapRouter);
  }

  return trusted;
};

export const isTrustedSpenderForChain = (chainId: SupportedChainId, spender: Address): boolean => {
  const trusted = getTrustedSpendersForChain(chainId).map((address) => address.toLowerCase());
  return trusted.includes(spender.toLowerCase());
};
