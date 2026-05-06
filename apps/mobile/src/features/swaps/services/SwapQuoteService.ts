/**
 * SwapQuoteService.ts
 *
 * Fetches and validates swap quotes from the registered providers.
 *
 * New API: uses networkKey.
 * Legacy API: uses chainId (kept for backwards compat).
 */

import {
  getSwapProvidersForChain,
  getSwapProvidersForNetwork,
} from "@/src/features/swaps/config/swapProviders";
import type {
  SwapQuoteRequest,
  SwapRouteProvider,
} from "@/src/features/swaps/providers/SwapRouteProvider";
import type { SwapQuote } from "@/src/features/swaps/types/swap";
import type { SupportedChainId } from "@/src/integration/chains";
import type { NetworkKey } from "@/src/integration/networks";
import { withTimeoutAndRetry } from "@/src/features/swaps/utils/withTimeoutAndRetry";

const assertSlippage = (slippageBps: number): void => {
  if (!Number.isInteger(slippageBps)) {
    throw new Error("Slippage must be an integer in basis points.");
  }
  if (slippageBps <= 0 || slippageBps > 5_000) {
    throw new Error("Slippage must be between 1 and 5000 bps.");
  }
};

const assertQuoteIntegrity = (quote: SwapQuote, request: SwapQuoteRequest): void => {
  if (quote.chainId !== request.chainId) {
    throw new Error("Quote chain does not match request chain.");
  }

  if (quote.sellToken.chainId !== request.chainId || quote.buyToken.chainId !== request.chainId) {
    throw new Error("Quote token chains do not match request chain.");
  }

  if (quote.sellToken.type !== request.sellToken.type || quote.buyToken.type !== request.buyToken.type) {
    throw new Error("Quote token types do not match requested pair.");
  }

  if (quote.sellToken.type === "erc20" && request.sellToken.type === "erc20") {
    if (quote.sellToken.address.toLowerCase() !== request.sellToken.address.toLowerCase()) {
      throw new Error("Quote sell token does not match request sell token.");
    }
  }

  if (quote.buyToken.type === "erc20" && request.buyToken.type === "erc20") {
    if (quote.buyToken.address.toLowerCase() !== request.buyToken.address.toLowerCase()) {
      throw new Error("Quote buy token does not match request buy token.");
    }
  }

  if (quote.sellAmountRaw !== request.sellAmountRaw) {
    throw new Error("Quote sell amount does not match requested amount.");
  }

  if (quote.estimatedBuyAmountRaw <= 0n || quote.minimumBuyAmountRaw <= 0n) {
    throw new Error("Quote amounts must be positive.");
  }

  if (quote.minimumBuyAmountRaw > quote.estimatedBuyAmountRaw) {
    throw new Error("Quote minimum output cannot exceed estimated output.");
  }

  if (!quote.calldata || quote.calldata === "0x") {
    throw new Error("Quote calldata is missing.");
  }
};

export class SwapQuoteService {
  // ─── Network-key-aware API ─────────────────────────────────────────────────

  static async getProviderForNetwork(request: SwapQuoteRequest): Promise<SwapRouteProvider> {
    const candidates = getSwapProvidersForNetwork(request.networkKey);
    if (!candidates.length) {
      throw new Error(`No swap provider configured for network ${request.networkKey}.`);
    }

    for (const provider of candidates) {
      const supports = await provider.supportsPair(request);
      if (supports) {
        return provider;
      }
    }

    throw new Error(
      `No configured swap provider supports ${request.sellToken.symbol} → ${request.buyToken.symbol} on ${request.networkKey}.`
    );
  }

  static async getQuote(request: SwapQuoteRequest): Promise<SwapQuote> {
    if (request.sellAmountRaw <= 0n) {
      throw new Error("Sell amount must be greater than zero.");
    }

    assertSlippage(request.slippageBps);

    // Prefer network-key-aware provider lookup
    const provider = await this.getProviderForNetwork(request);
    const quote = await withTimeoutAndRetry(() => provider.getQuote(request), { timeoutMs: 8000 });
    assertQuoteIntegrity(quote, request);

    return quote;
  }

  // ─── Legacy chain-id API ───────────────────────────────────────────────────

  /** @deprecated Use getProviderForNetwork(request) instead. */
  static async getProvider(request: SwapQuoteRequest): Promise<SwapRouteProvider> {
    const candidates = getSwapProvidersForChain(request.chainId);
    if (!candidates.length) {
      throw new Error(`No swap provider configured for chain ${request.chainId}.`);
    }

    for (const provider of candidates) {
      const supports = await provider.supportsPair(request);
      if (supports) {
        return provider;
      }
    }

    throw new Error("No configured swap provider supports this token pair on the selected chain.");
  }

  /** @deprecated Use getQuote(request) which now uses networkKey. */
  static getProvidersForChain(chainId: SupportedChainId): SwapRouteProvider[] {
    return getSwapProvidersForChain(chainId);
  }

  static getProvidersForNetwork(networkKey: NetworkKey): SwapRouteProvider[] {
    return getSwapProvidersForNetwork(networkKey);
  }
}
