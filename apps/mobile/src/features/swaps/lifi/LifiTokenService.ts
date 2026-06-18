/**
 * LifiTokenService
 *
 * Fetches the full LI.FI-routable token list for a given chain from
 * https://li.quest/v1/tokens and caches the result in memory for the
 * lifetime of the app session (no repeated calls for the same chain).
 *
 * The cache is per real chain ID (8453, 42161) so fork and mainnet share
 * the same result.
 */

import { getAddress } from "viem";
import type { Address } from "viem";
import type { TokenMetadata } from "@/src/features/assets/types/token";
import type { NetworkKey } from "@/src/integration/networks";
import type { SupportedChainId } from "@/src/integration/chains";
import { LIFI_BASE_URL, lifiChainIdForNetwork } from "./constants";

type LifiTokenRaw = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
};

type LifiTokensResponse = {
  tokens: Record<string, LifiTokenRaw[]>;
};

const NATIVE_SENTINEL = "0x0000000000000000000000000000000000000000";

// In-flight promise cache — prevents duplicate concurrent requests for the same chain
const inflight = new Map<number, Promise<TokenMetadata[]>>();
// Resolved cache — subsequent calls return immediately
const resolved = new Map<number, TokenMetadata[]>();

async function fetchForChain(chainId: number): Promise<TokenMetadata[]> {
  const res = await fetch(`${LIFI_BASE_URL}/tokens?chains=${chainId}`);
  if (!res.ok) {
    throw new Error(`LI.FI tokens fetch failed (${res.status})`);
  }

  const json = (await res.json()) as LifiTokensResponse;
  const raw: LifiTokenRaw[] = json.tokens[String(chainId)] ?? [];

  const tokens: TokenMetadata[] = [];
  for (const t of raw) {
    if (t.address.toLowerCase() === NATIVE_SENTINEL) continue;
    let address: Address;
    try {
      address = getAddress(t.address);
    } catch {
      // Skip tokens with non-checksummed or malformed addresses
      continue;
    }
    tokens.push({
      chainId: chainId as SupportedChainId,
      type: "erc20",
      address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      logoUri: t.logoURI,
      isSwapSupported: true,
      isVerified: true,
      source: "custom",
    });
  }

  return tokens;
}

export const LifiTokenService = {
  /**
   * Returns LI.FI-routable ERC20 tokens for a chain.
   * Concurrent callers share the same in-flight request.
   * Resolved results are cached for the session.
   */
  async getTokensForChain(chainId: number): Promise<TokenMetadata[]> {
    const cached = resolved.get(chainId);
    if (cached) return cached;

    let promise = inflight.get(chainId);
    if (!promise) {
      promise = fetchForChain(chainId).then((tokens) => {
        resolved.set(chainId, tokens);
        inflight.delete(chainId);
        return tokens;
      }).catch((err) => {
        inflight.delete(chainId);
        throw err;
      });
      inflight.set(chainId, promise);
    }

    return promise;
  },

  async getTokensForNetwork(networkKey: NetworkKey): Promise<TokenMetadata[]> {
    const chainId = lifiChainIdForNetwork(networkKey);
    return this.getTokensForChain(chainId);
  },

  clearCache(): void {
    resolved.clear();
    inflight.clear();
  },
};
