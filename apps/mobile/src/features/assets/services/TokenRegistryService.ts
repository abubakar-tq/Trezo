import { getChainConfig, type SupportedChainId } from "@/src/integration/chains";
import { getDeployment } from "@/src/integration/viem/deployments";
import type { TokenKey, TokenMetadata } from "@/src/features/assets/types/token";
import type { Address } from "viem";

const NATIVE_TOKEN_KEY = "native";

const normalizeTokenKey = (tokenKey: string): string => {
  if (!tokenKey || tokenKey.toLowerCase() === NATIVE_TOKEN_KEY) {
    return NATIVE_TOKEN_KEY;
  }
  return tokenKey.toLowerCase();
};

const buildNativeToken = (chainId: SupportedChainId): TokenMetadata => {
  const chain = getChainConfig(chainId);
  return {
    chainId,
    address: "native",
    type: "native",
    symbol: chain.nativeCurrency.symbol,
    name: chain.nativeCurrency.name,
    decimals: chain.nativeCurrency.decimals,
    isVerified: true,
    source: "builtin",
  };
};

export class TokenRegistryService {
  private static readonly tokenCache = new Map<SupportedChainId, Map<string, TokenMetadata>>();

  private static ensureTokens(chainId: SupportedChainId): Map<string, TokenMetadata> {
    const cached = this.tokenCache.get(chainId);
    if (cached) {
      return cached;
    }

    const tokens = new Map<string, TokenMetadata>();

    const nativeToken = buildNativeToken(chainId);
    tokens.set(NATIVE_TOKEN_KEY, nativeToken);

    const deployment = getDeployment(chainId);
    if (chainId === 31337 && deployment?.usdc) {
      const usdc = deployment.usdc.toLowerCase() as Address;
      tokens.set(usdc, {
        chainId,
        address: deployment.usdc,
        type: "erc20",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        isVerified: true,
        source: "deployment",
      });
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

  static getToken(chainId: SupportedChainId, tokenKey: TokenKey | string): TokenMetadata | null {
    const tokens = this.ensureTokens(chainId);
    return tokens.get(normalizeTokenKey(tokenKey)) ?? null;
  }

  static refresh(chainId?: SupportedChainId): void {
    if (chainId === undefined) {
      this.tokenCache.clear();
      return;
    }
    this.tokenCache.delete(chainId);
  }
}
