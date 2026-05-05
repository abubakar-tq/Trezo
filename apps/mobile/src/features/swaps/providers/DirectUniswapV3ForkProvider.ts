/**
 * DirectUniswapV3ForkProvider.ts
 *
 * Swap route provider that executes real Uniswap V3 quotes and builds
 * SwapRouter02 exactInputSingle calldata for use with the Trezo smart account.
 *
 * Supported networks: base-mainnet-fork, base-mainnet
 *
 * Non-goals for this first iteration:
 *   - No native ETH routes (WETH wrapping required separately)
 *   - No multi-hop routes
 *   - No Permit2
 *   - No route optimization
 */

import type { SwapRouteProvider, SwapQuoteRequest } from "@/src/features/swaps/providers/SwapRouteProvider";
import type { SwapQuote } from "@/src/features/swaps/types/swap";
import type { SupportedChainId } from "@/src/integration/chains";
import type { NetworkKey } from "@/src/integration/networks";
import { getPublicClientForNetwork } from "@/src/integration/viem/clients";
import { getDexConfig, getPoolConfig } from "@/src/features/swaps/config/dexRegistry";
import { encodeFunctionData, type Address, type Hex } from "viem";

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const FACTORY_ABI = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
] as const;

/**
 * QuoterV2.quoteExactInputSingle — NOT a Solidity view function;
 * must be called via simulateContract (eth_call), not readContract.
 */
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

const SWAP_ROUTER02_ABI = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

// ─── Supported networks ────────────────────────────────────────────────────────

const SUPPORTED_NETWORKS: NetworkKey[] = ["base-mainnet-fork", "base-mainnet"];

// ─── Provider implementation ───────────────────────────────────────────────────

export class DirectUniswapV3ForkProvider implements SwapRouteProvider {
  readonly id = "direct-uniswap-v3-fork";
  readonly label = "Uniswap V3";

  supportsChain(_chainId: SupportedChainId): boolean {
    // This provider is network-key-aware — use supportsNetwork() instead.
    return false;
  }

  supportsNetwork(networkKey: NetworkKey): boolean {
    return SUPPORTED_NETWORKS.includes(networkKey);
  }

  async supportsPair(request: SwapQuoteRequest): Promise<boolean> {
    if (!this.supportsNetwork(request.networkKey)) return false;
    // ERC20→ETH not yet supported (requires WETH unwrap multicall)
    if (request.buyToken.type !== "erc20") return false;

    const dexConfig = getDexConfig(request.networkKey);
    if (!dexConfig) return false;

    // Native ETH sell is routed through wrapped native (WETH) — router handles wrap
    const effectiveSellAddress: Address =
      request.sellToken.type === "native"
        ? dexConfig.wrappedNativeAddress
        : (request.sellToken.address as Address);

    const pool = getPoolConfig(
      request.networkKey,
      effectiveSellAddress,
      request.buyToken.address as Address,
    );

    return pool !== undefined;
  }

  async getQuote(request: SwapQuoteRequest): Promise<SwapQuote> {
    const { networkKey, chainId, account, sellToken, buyToken, sellAmountRaw, slippageBps } = request;

    // ── 1. Resolve DEX config ─────────────────────────────────────────────────
    const dexConfig = getDexConfig(networkKey);
    if (!dexConfig) {
      throw new Error(`No DEX config found for network ${networkKey}.`);
    }

    // ── 2. Validate pair ──────────────────────────────────────────────────────
    if (buyToken.type !== "erc20") {
      throw new Error("DirectUniswapV3ForkProvider does not support ERC20 → native ETH swaps yet.");
    }
    if (sellAmountRaw <= 0n) {
      throw new Error("Sell amount must be greater than zero.");
    }

    // Native ETH sell: router accepts ETH as msg.value and wraps to WETH internally
    const isNativeETHSell = sellToken.type === "native";
    const effectiveSellAddress: Address = isNativeETHSell
      ? dexConfig.wrappedNativeAddress
      : (sellToken.address as Address);

    const poolConfig = getPoolConfig(
      networkKey,
      effectiveSellAddress,
      buyToken.address as Address,
    );
    if (!poolConfig) {
      throw new Error(
        `Unsupported pair on ${networkKey}: ${sellToken.symbol} → ${buyToken.symbol}. Configure the pool in dexRegistry.ts.`
      );
    }

    const client = getPublicClientForNetwork(networkKey);
    const feeTier = poolConfig.feeTier;

    // ── 3. Resolve pool address — use hardcoded address when available to avoid RPC round-trips ─
    let poolAddress: Address;

    if (poolConfig.poolAddress) {
      // Hardcoded in dexRegistry — skip factory lookup entirely
      poolAddress = poolConfig.poolAddress;
    } else {
      // Dynamic lookup via factory (slower — avoid for remote infra RPCs)
      const factoryPool = await client.readContract({
        address: dexConfig.factoryAddress,
        abi: FACTORY_ABI,
        functionName: "getPool",
        args: [effectiveSellAddress, buyToken.address as Address, feeTier],
      }) as Address;

      if (
        !factoryPool ||
        factoryPool === "0x0000000000000000000000000000000000000000"
      ) {
        throw new Error(
          `No Uniswap V3 pool found for ${sellToken.symbol}/${buyToken.symbol} fee tier ${feeTier} on ${networkKey}. ` +
          `Try fee tier 3000 or check that the fork block has liquidity.`
        );
      }

      poolAddress = factoryPool;
    }

    // ── 4. Quote with QuoterV2 via simulateContract ───────────────────────────
    let estimatedBuyAmountRaw: bigint;

    try {
      // QuoterV2 is NOT a view function — it must be simulated via eth_call.
      const result = await client.simulateContract({
        address: dexConfig.quoterAddress,
        abi: QUOTER_V2_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: effectiveSellAddress,
            tokenOut: buyToken.address as Address,
            amountIn: sellAmountRaw,
            fee: feeTier,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      // result.result is [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate]
      estimatedBuyAmountRaw = (result.result as [bigint, bigint, number, bigint])[0];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`QuoterV2 quote failed for ${sellToken.symbol}→${buyToken.symbol}: ${message}`);
    }

    if (estimatedBuyAmountRaw <= 0n) {
      throw new Error("Quoter returned zero output amount. Pool may have insufficient liquidity.");
    }

    // ── 5. Compute minimum output with slippage ───────────────────────────────
    const minimumBuyAmountRaw =
      (estimatedBuyAmountRaw * BigInt(10_000 - slippageBps)) / 10_000n;

    if (minimumBuyAmountRaw <= 0n) {
      throw new Error("Slippage is too high — minimum buy amount is zero.");
    }

    // ── 6. Encode SwapRouter02 exactInputSingle calldata ─────────────────────
    // For native ETH: tokenIn = WETH, msg.value = sellAmountRaw — router wraps automatically
    const calldata = encodeFunctionData({
      abi: SWAP_ROUTER02_ABI,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: effectiveSellAddress,
          tokenOut: buyToken.address as Address,
          fee: feeTier,
          recipient: account,
          amountIn: sellAmountRaw,
          amountOutMinimum: minimumBuyAmountRaw,
          sqrtPriceLimitX96: 0n,
        },
      ],
    }) as Hex;

    // ── 7. Return quote ───────────────────────────────────────────────────────
    const now = Date.now();
    return {
      quoteId: `uniswap-v3-fork-${networkKey}-${sellToken.symbol}-${buyToken.symbol}-${now}`,
      chainId,
      networkKey,
      sellToken,
      buyToken,
      sellAmountRaw,
      estimatedBuyAmountRaw,
      minimumBuyAmountRaw,
      slippageBps,
      spender: dexConfig.routerAddress,
      target: dexConfig.routerAddress,
      // Native ETH sell: pass ETH as value so the router can wrap it to WETH
      value: isNativeETHSell ? sellAmountRaw : 0n,
      calldata,
      provider: this.id,
      providerId: this.id,
      expiresAt: new Date(now + 30_000).toISOString(),
      routeMetadata: {
        dexId: dexConfig.dexId,
        dexLabel: dexConfig.label,
        feeTier,
        poolAddress,
        quoterAddress: dexConfig.quoterAddress,
        routerAddress: dexConfig.routerAddress,
        routeKind: isNativeETHSell ? "v3_eth_exact_input_single" : "v3_exact_input_single",
        forkSourceChainId: 8453,
      },
    };
  }
}
