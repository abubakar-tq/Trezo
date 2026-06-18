/**
 * BridgeDestQuoteService.ts
 *
 * Quotes the destination-chain Uniswap V3 swap that CrossChainExecutor will
 * run after Across V3 fills the deposit. Given the canonical bridged token,
 * the user's desired output token, and the post-fee canonical amount the
 * relayer will deliver, returns the (minOut, feeTier, deadline) that gets
 * packed into the Across BridgeMessage.
 *
 * Why this is separate from SwapQuoteService: this runs against a *different
 * chain* than the user's active chain, and it produces just the parameters
 * the executor needs — no calldata, no spender, no allowance check.
 */

import { getDexConfig, getPoolConfig } from "@/src/features/swaps/config/dexRegistry";
import type { TokenMetadata } from "@/src/features/assets/types/token";
import { getPublicClientForNetwork } from "@/src/integration/viem/clients";
import type { NetworkKey } from "@/src/integration/networks";
import { withTimeoutAndRetry } from "@/src/features/swaps/utils/withTimeoutAndRetry";
import type { Address } from "viem";

// QuoterV2.quoteExactInputSingle — NOT a Solidity view; must be called via
// simulateContract (eth_call), not readContract.
const QUOTER_V2_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

export type BridgeDestQuoteRequest = {
  destNetworkKey: NetworkKey;
  /** Token the SpokePool delivers on destination (the bridge route's canonical pair). */
  canonicalToken: TokenMetadata;
  /** Token the user actually wants on destination. */
  outputToken: TokenMetadata;
  /** Amount of canonicalToken the executor will hold after the Across fill (post bridge fee). */
  inputAmountRaw: bigint;
  /** Slippage tolerance for the dest-side swap, in basis points. */
  slippageBps: number;
  /**
   * Unix-seconds deadline for the dest-side swap. Should match (or exceed) the
   * Across fillDeadline so the swap window covers the relayer's fill window.
   */
  deadlineSec: number;
};

export type BridgeDestQuote = {
  feeTier: number;
  poolAddress: Address;
  expectedOutRaw: bigint;
  minOutRaw: bigint;
  slippageBps: number;
  deadlineSec: number;
};

const assertSlippage = (slippageBps: number): void => {
  if (!Number.isInteger(slippageBps) || slippageBps <= 0 || slippageBps > 5_000) {
    throw new Error("Slippage must be an integer between 1 and 5000 bps.");
  }
};

export class BridgeDestQuoteService {
  static async getQuote(request: BridgeDestQuoteRequest): Promise<BridgeDestQuote> {
    if (request.inputAmountRaw <= 0n) {
      throw new Error("Destination-side input amount must be greater than zero.");
    }
    if (request.canonicalToken.type !== "erc20") {
      throw new Error("Destination-side input must be ERC20.");
    }
    if (request.outputToken.type !== "erc20") {
      throw new Error("Destination-side output must be ERC20.");
    }
    if (
      request.canonicalToken.address.toLowerCase()
      === request.outputToken.address.toLowerCase()
    ) {
      throw new Error("Destination-side swap not needed: canonical and output tokens are the same.");
    }
    assertSlippage(request.slippageBps);

    const dexConfig = getDexConfig(request.destNetworkKey);
    if (!dexConfig) {
      throw new Error(
        `No DEX configured on destination ${request.destNetworkKey} — cross-chain swap output not supported there.`,
      );
    }

    const poolConfig = getPoolConfig(
      request.destNetworkKey,
      request.canonicalToken.address as Address,
      request.outputToken.address as Address,
    );
    if (!poolConfig) {
      throw new Error(
        `No Uniswap V3 pool on ${request.destNetworkKey} for `
          + `${request.canonicalToken.symbol} → ${request.outputToken.symbol}. `
          + `Pick a different output token or add the pool to dexRegistry.`,
      );
    }

    const client = getPublicClientForNetwork(request.destNetworkKey);

    let expectedOutRaw: bigint;
    try {
      // Bound the cross-chain RPC like every sibling service (Balance/Allowance).
      // Without this it rode only viem's 60s transport timeout, which froze the
      // bridge "Review" spinner — this call runs inside prepareBridge, BEFORE the
      // confirm sheet is presented, so a stall here hangs the whole flow.
      const result = await withTimeoutAndRetry(
        () => client.simulateContract({
          address: dexConfig.quoterAddress,
          abi: QUOTER_V2_ABI,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: request.canonicalToken.address as Address,
              tokenOut: request.outputToken.address as Address,
              amountIn: request.inputAmountRaw,
              fee: poolConfig.feeTier,
              sqrtPriceLimitX96: 0n,
            },
          ],
        }),
        { timeoutMs: 8_000 },
      );
      expectedOutRaw = (result.result as [bigint, bigint, number, bigint])[0];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Destination-side QuoterV2 failed for `
          + `${request.canonicalToken.symbol}→${request.outputToken.symbol} on ${request.destNetworkKey}: ${message}`,
      );
    }

    if (expectedOutRaw <= 0n) {
      throw new Error(
        `Destination-side quoter returned zero output on ${request.destNetworkKey}. `
          + `Pool may have insufficient liquidity for ${request.canonicalToken.symbol}→${request.outputToken.symbol}.`,
      );
    }

    const minOutRaw = (expectedOutRaw * BigInt(10_000 - request.slippageBps)) / 10_000n;
    if (minOutRaw <= 0n) {
      throw new Error("Destination-side minOut rounds to zero — slippage too high or amount too small.");
    }

    return {
      feeTier: poolConfig.feeTier,
      poolAddress: (poolConfig.poolAddress ?? ("0x0000000000000000000000000000000000000000" as Address)),
      expectedOutRaw,
      minOutRaw,
      slippageBps: request.slippageBps,
      deadlineSec: request.deadlineSec,
    };
  }
}
