/**
 * SwapRouteProvider.ts
 *
 * Interface for all swap route providers (Uniswap V3, aggregators, etc.)
 */

import type { TokenMetadata } from "@/src/features/assets/types/token";
import type { SwapQuote } from "@/src/features/swaps/types/swap";
import type { SupportedChainId } from "@/src/integration/chains";
import type { NetworkKey } from "@/src/integration/networks";
import type { Address } from "viem";

export type SwapQuoteRequest = {
  networkKey: NetworkKey;
  chainId: SupportedChainId;
  account: Address;
  sellToken: TokenMetadata;
  buyToken: TokenMetadata;
  sellAmountRaw: bigint;
  slippageBps: number;
};

export interface SwapRouteProvider {
  readonly id: string;
  readonly label: string;
  /** @deprecated Use supportsNetwork(networkKey). */
  supportsChain(chainId: SupportedChainId): boolean;
  supportsNetwork(networkKey: NetworkKey): boolean;
  supportsPair(request: SwapQuoteRequest): Promise<boolean>;
  getQuote(request: SwapQuoteRequest): Promise<SwapQuote>;
}
