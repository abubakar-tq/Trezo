/**
 * TokenRegistryService.ts
 *
 * Central token registry.
 *
 * New API (network-key aware):
 *   listTokensForNetwork(networkKey)
 *   listSwapTokensForNetwork(networkKey)
 *   getTokenForNetwork(networkKey, tokenKey)
 *   assertTokenOnNetwork(networkKey, token)
 *
 * Legacy API (chain-id based — kept for backwards compat):
 *   listTokens(chainId)
 *   listSwapTokens(chainId)
 *   getToken(chainId, tokenKey)
 *   assertTokenOnChain(chainId, token)
 */

import { getChainConfig, type SupportedChainId } from "@/src/integration/chains";
import { getDeployment } from "@/src/integration/viem/deployments";
import type { TokenKey, TokenMetadata } from "@/src/features/assets/types/token";
import type { NetworkKey } from "@/src/integration/networks";
import { getNetworkConfig } from "@/src/integration/networks";
import type { Address } from "viem";
import { BUILTIN_TOKENS_BY_NETWORK } from "@/src/features/assets/config/tokenRegistry";

const NATIVE_TOKEN_KEY = "native";

const normalizeTokenKey = (tokenKey: string): string => {
  if (!tokenKey || tokenKey.toLowerCase() === NATIVE_TOKEN_KEY) {
    return NATIVE_TOKEN_KEY;
  }
  return tokenKey.toLowerCase();
};

const buildNativeToken = (chainId: SupportedChainId, networkKey?: NetworkKey): TokenMetadata => {
  const chain = getChainConfig(chainId);
  return {
    chainId,
    networkKey,
    address: "native",
    type: "native",
    symbol: chain.nativeCurrency.symbol,
    name: chain.nativeCurrency.name,
    decimals: chain.nativeCurrency.decimals,
    tags: ["native", "gas"],
    isSwapSupported: true,
    isVerified: true,
    source: "builtin",
  };
};

const addToken = (map: Map<string, TokenMetadata>, token: TokenMetadata): void => {
  const key = token.type === "native" ? NATIVE_TOKEN_KEY : token.address.toLowerCase();
  if (!map.has(key)) {
    map.set(key, token);
  }
};

const makeErc20Token = (params: {
  chainId: SupportedChainId;
  networkKey?: NetworkKey;
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  source: TokenMetadata["source"];
  isSwapSupported?: boolean;
  tags?: string[];
}): TokenMetadata => ({
  chainId: params.chainId,
  networkKey: params.networkKey,
  address: params.address,
  type: "erc20",
  symbol: params.symbol,
  name: params.name,
  decimals: params.decimals,
  tags: params.tags,
  isSwapSupported: params.isSwapSupported ?? true,
  isVerified: true,
  source: params.source,
});

const collectDeploymentTokens = (chainId: SupportedChainId): TokenMetadata[] => {
  const deployment = getDeployment(chainId as never);
  if (!deployment) return [];

  const tokens: TokenMetadata[] = [];

  if (deployment.usdc) {
    tokens.push(makeErc20Token({
      chainId,
      address: deployment.usdc,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      source: "deployment",
      tags: ["stablecoin", "quote"],
      isSwapSupported: true,
    }));
  }

  if (deployment.mockSwapTokens) {
    for (const [symbol, address] of Object.entries(deployment.mockSwapTokens)) {
      if (!address) continue;
      const meta = deployment.mockSwapTokenMeta?.[symbol];
      tokens.push(makeErc20Token({
        chainId,
        address,
        symbol,
        name: meta?.name ?? symbol,
        decimals: meta?.decimals ?? 18,
        source: "deployment",
        tags: meta?.tags ?? ["mock-swap"],
        isSwapSupported: meta?.isSwapSupported ?? true,
      }));
    }
  }

  return tokens;
};

const collectBuiltinTokensForNetwork = (networkKey: NetworkKey): TokenMetadata[] => {
  const builtins = BUILTIN_TOKENS_BY_NETWORK[networkKey] ?? [];
  return builtins as TokenMetadata[];
};

const buildTokenMapForNetwork = (networkKey: NetworkKey): Map<string, TokenMetadata> => {
  const network = getNetworkConfig(networkKey);
  const chainId = network.chainId;
  const tokens = new Map<string, TokenMetadata>();

  // 1. Native ETH (always first)
  addToken(tokens, buildNativeToken(chainId, networkKey));

  // 2. Network-keyed builtin tokens (real USDC/WETH on Base fork etc.)
  for (const token of collectBuiltinTokensForNetwork(networkKey)) {
    addToken(tokens, token);
  }

  // 3. Deployment manifest tokens (mock tokens from local Anvil)
  for (const token of collectDeploymentTokens(chainId)) {
    addToken(tokens, token);
  }

  return tokens;
};

export class TokenRegistryService {
  // Legacy chain-id cache
  private static readonly tokenCache = new Map<SupportedChainId, Map<string, TokenMetadata>>();
  // Network-key cache
  private static readonly networkTokenCache = new Map<NetworkKey, Map<string, TokenMetadata>>();

  // ─── Legacy chain-id methods (backwards compat) ────────────────────────────

  private static ensureTokens(chainId: SupportedChainId): Map<string, TokenMetadata> {
    const cached = this.tokenCache.get(chainId);
    if (cached) {
      return cached;
    }

    const tokens = new Map<string, TokenMetadata>();

    addToken(tokens, buildNativeToken(chainId));

    for (const token of collectDeploymentTokens(chainId)) {
      addToken(tokens, token);
    }

    this.tokenCache.set(chainId, tokens);
    return tokens;
  }

  static listTokens(chainId: SupportedChainId): TokenMetadata[] {
    const tokens = this.ensureTokens(chainId);
    const nativeToken = tokens.get(NATIVE_TOKEN_KEY);

    const rest = Array.from(tokens.entries())
      .filter(([key]) => key !== NATIVE_TOKEN_KEY)
      .map(([, token]) => token)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));

    return nativeToken ? [nativeToken, ...rest] : rest;
  }

  static listSwapTokens(chainId: SupportedChainId): TokenMetadata[] {
    return this.listTokens(chainId).filter((token) => token.isSwapSupported !== false);
  }

  static getToken(chainId: SupportedChainId, tokenKey: TokenKey | string): TokenMetadata | null {
    const tokens = this.ensureTokens(chainId);
    return tokens.get(normalizeTokenKey(tokenKey)) ?? null;
  }

  static assertTokenOnChain(chainId: SupportedChainId, token: TokenMetadata): TokenMetadata {
    const key = token.type === "native" ? "native" : token.address;
    const found = this.getToken(chainId, key);
    if (!found) {
      throw new Error(`Token ${token.symbol} is not registered on chain ${chainId}.`);
    }
    return found;
  }

  // ─── Network-key-aware methods ─────────────────────────────────────────────

  private static ensureTokensForNetwork(networkKey: NetworkKey): Map<string, TokenMetadata> {
    const cached = this.networkTokenCache.get(networkKey);
    if (cached) return cached;

    const tokens = buildTokenMapForNetwork(networkKey);
    this.networkTokenCache.set(networkKey, tokens);
    return tokens;
  }

  static listTokensForNetwork(networkKey: NetworkKey): TokenMetadata[] {
    const tokens = this.ensureTokensForNetwork(networkKey);
    const nativeToken = tokens.get(NATIVE_TOKEN_KEY);

    const rest = Array.from(tokens.entries())
      .filter(([key]) => key !== NATIVE_TOKEN_KEY)
      .map(([, token]) => token)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));

    return nativeToken ? [nativeToken, ...rest] : rest;
  }

  static listSwapTokensForNetwork(networkKey: NetworkKey): TokenMetadata[] {
    return this.listTokensForNetwork(networkKey).filter(
      (token) => token.isSwapSupported !== false
    );
  }

  static getTokenForNetwork(networkKey: NetworkKey, tokenKey: TokenKey | string): TokenMetadata | null {
    const tokens = this.ensureTokensForNetwork(networkKey);
    return tokens.get(normalizeTokenKey(tokenKey)) ?? null;
  }

  static assertTokenOnNetwork(networkKey: NetworkKey, token: TokenMetadata): TokenMetadata {
    const key = token.type === "native" ? "native" : token.address;
    const found = this.getTokenForNetwork(networkKey, key);
    if (!found) {
      throw new Error(`Token ${token.symbol} is not registered on network ${networkKey}.`);
    }
    return found;
  }

  /** Invalidate cache for all or a specific network/chain. */
  static refresh(chainId?: SupportedChainId, networkKey?: NetworkKey): void {
    if (chainId === undefined && networkKey === undefined) {
      this.tokenCache.clear();
      this.networkTokenCache.clear();
      return;
    }
    if (chainId !== undefined) this.tokenCache.delete(chainId);
    if (networkKey !== undefined) this.networkTokenCache.delete(networkKey);
  }
}
