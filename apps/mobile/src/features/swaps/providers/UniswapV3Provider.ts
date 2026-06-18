/**
 * UniswapV3Provider.ts
 *
 * Swap route provider that executes real Uniswap V3 quotes and builds
 * SwapRouter02 exactInputSingle calldata for use with the Trezo smart account.
 *
 * Network support is driven entirely by dexRegistry: any network with a
 * DexConfig is accepted. Pool addresses are hardcoded in dexRegistry where
 * known and looked up via factory.getPool() otherwise.
 *
 * Non-goals for this first iteration:
 *   - No ERC20 -> native ETH routes (router unwrap multicall required)
 *   - No multi-hop routes
 *   - No Permit2
 *   - No route optimization
 */

import type { SwapRouteProvider, SwapQuoteRequest } from "@/src/features/swaps/providers/SwapRouteProvider";
import type { SwapQuote } from "@/src/features/swaps/types/swap";
import type { SupportedChainId } from "@/src/integration/chains";
import type { NetworkKey } from "@/src/integration/networks";
import { getPublicClientForNetwork } from "@/src/integration/viem/clients";
import { getDexConfig, getMultihopRoute, getPoolConfig } from "@/src/features/swaps/config/dexRegistry";
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
  {
    type: "function",
    name: "unwrapWETH9",
    stateMutability: "payable",
    inputs: [
      { name: "amountMinimum", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "multicall",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
] as const;

// ─── Multi-hop ABIs ───────────────────────────────────────────────────────────

const QUOTER_V2_EXACT_INPUT_ABI = [
  {
    type: "function",
    name: "quoteExactInput",
    stateMutability: "nonpayable",
    inputs: [
      { name: "path", type: "bytes" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96AfterList", type: "uint160[]" },
      { name: "initializedTicksCrossedList", type: "uint32[]" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

const SWAP_ROUTER02_EXACT_INPUT_ABI = [
  {
    type: "function",
    name: "exactInput",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "path", type: "bytes" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

/**
 * Encode a Uniswap V3 multi-hop path as tightly packed bytes:
 * sellToken (20B) | fee0 (3B) | legs[0].token (20B) | fee1 (3B) | legs[1].token (20B) | ...
 */
const encodeMultihopPath = (sellToken: Address, legs: Array<{ fee: number; token: Address }>): Hex => {
  let hex = sellToken.slice(2).toLowerCase();
  for (const { fee, token } of legs) {
    hex += fee.toString(16).padStart(6, "0") + token.slice(2).toLowerCase();
  }
  return `0x${hex}` as Hex;
};

// ─── Provider implementation ───────────────────────────────────────────────────

export class UniswapV3Provider implements SwapRouteProvider {
  readonly id = "uniswap-v3";
  readonly label = "Uniswap V3";

  supportsChain(_chainId: SupportedChainId): boolean {
    // Network-key-aware — use supportsNetwork() instead.
    return false;
  }

  supportsNetwork(networkKey: NetworkKey): boolean {
    return getDexConfig(networkKey) !== undefined;
  }

  async supportsPair(request: SwapQuoteRequest): Promise<boolean> {
    if (!this.supportsNetwork(request.networkKey)) return false;
    // Reject native→native (no swap needed)
    if (request.sellToken.type === "native" && request.buyToken.type === "native") return false;

    const dexConfig = getDexConfig(request.networkKey);
    if (!dexConfig) return false;

    // Native ETH on either side routes through wrapped native (WETH)
    const effectiveSellAddress: Address =
      request.sellToken.type === "native"
        ? dexConfig.wrappedNativeAddress
        : (request.sellToken.address as Address);
    const effectiveBuyAddress: Address =
      request.buyToken.type === "native"
        ? dexConfig.wrappedNativeAddress
        : (request.buyToken.address as Address);

    if (getPoolConfig(request.networkKey, effectiveSellAddress, effectiveBuyAddress)) return true;
    if (getMultihopRoute(request.networkKey, effectiveSellAddress, effectiveBuyAddress)) return true;
    return false;
  }

  async getQuote(request: SwapQuoteRequest): Promise<SwapQuote> {
    const { networkKey, chainId, account, sellToken, buyToken, sellAmountRaw, slippageBps } = request;

    // ── 1. Resolve DEX config ─────────────────────────────────────────────────
    const dexConfig = getDexConfig(networkKey);
    if (!dexConfig) {
      throw new Error(`No DEX config found for network ${networkKey}.`);
    }

    // ── 2. Validate pair ──────────────────────────────────────────────────────
    if (sellAmountRaw <= 0n) {
      throw new Error("Sell amount must be greater than zero.");
    }

    // Native ETH sell: router accepts ETH as msg.value and wraps to WETH internally
    // Native ETH buy: route to WETH then unwrap via multicall(unwrapWETH9)
    const isNativeETHSell = sellToken.type === "native";
    const isNativeETHBuy = buyToken.type === "native";

    if (isNativeETHSell && isNativeETHBuy) {
      throw new Error("UniswapV3Provider cannot swap native ETH to native ETH.");
    }

    const effectiveSellAddress: Address = isNativeETHSell
      ? dexConfig.wrappedNativeAddress
      : (sellToken.address as Address);
    const effectiveBuyAddress: Address = isNativeETHBuy
      ? dexConfig.wrappedNativeAddress
      : (buyToken.address as Address);

    const poolConfig = getPoolConfig(networkKey, effectiveSellAddress, effectiveBuyAddress);
    const multihopRoute = !poolConfig
      ? getMultihopRoute(networkKey, effectiveSellAddress, effectiveBuyAddress)
      : undefined;

    if (!poolConfig && !multihopRoute) {
      throw new Error(
        `Unsupported pair on ${networkKey}: ${sellToken.symbol} → ${buyToken.symbol}. Configure the pool in dexRegistry.ts.`
      );
    }

    const client = getPublicClientForNetwork(networkKey);

    // ── Multi-hop path (e.g. USDC → WETH → LINK) ─────────────────────────────
    if (multihopRoute) {
      const path = encodeMultihopPath(effectiveSellAddress, multihopRoute.legs);

      let estimatedBuyAmountRaw: bigint;
      try {
        const result = await client.simulateContract({
          address: dexConfig.quoterAddress,
          abi: QUOTER_V2_EXACT_INPUT_ABI,
          functionName: "quoteExactInput",
          args: [path, sellAmountRaw],
        });
        estimatedBuyAmountRaw = (result.result as [bigint, bigint[], number[], bigint])[0];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`QuoterV2 multihop quote failed for ${sellToken.symbol}→${buyToken.symbol}: ${message}`);
      }

      if (estimatedBuyAmountRaw <= 0n) {
        throw new Error("Quoter returned zero output amount. Pool may have insufficient liquidity.");
      }

      const minimumBuyAmountRaw = (estimatedBuyAmountRaw * BigInt(10_000 - slippageBps)) / 10_000n;
      if (minimumBuyAmountRaw <= 0n) {
        throw new Error("Slippage is too high — minimum buy amount is zero.");
      }

      const calldata = encodeFunctionData({
        abi: SWAP_ROUTER02_EXACT_INPUT_ABI,
        functionName: "exactInput",
        args: [{
          path,
          recipient: account,
          amountIn: sellAmountRaw,
          amountOutMinimum: minimumBuyAmountRaw,
        }],
      }) as Hex;

      const now = Date.now();
      return {
        quoteId: `uniswap-v3-multihop-${networkKey}-${sellToken.symbol}-${buyToken.symbol}-${now}`,
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
        value: 0n,
        calldata,
        provider: this.id,
        providerId: this.id,
        expiresAt: new Date(now + 30_000).toISOString(),
        routeMetadata: {
          dexId: dexConfig.dexId,
          dexLabel: dexConfig.label,
          routeKind: "v3_multihop",
          path,
        },
      };
    }

    // ── Single-hop path ───────────────────────────────────────────────────────
    const feeTier = poolConfig!.feeTier;

    // ── 3. Resolve pool address — use hardcoded address when available to avoid RPC round-trips ─
    let poolAddress: Address;

    if (poolConfig!.poolAddress) {
      // Hardcoded in dexRegistry — skip factory lookup entirely
      poolAddress = poolConfig!.poolAddress;
    } else {
      // Dynamic lookup via factory (slower — avoid for remote infra RPCs)
      const factoryPool = await client.readContract({
        address: dexConfig.factoryAddress,
        abi: FACTORY_ABI,
        functionName: "getPool",
        args: [effectiveSellAddress, effectiveBuyAddress, feeTier],
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
            tokenOut: effectiveBuyAddress,
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

    // ── 6. Encode calldata ────────────────────────────────────────────────────
    // ETH sell  : tokenIn=WETH, msg.value=sellAmountRaw — router wraps automatically.
    // ETH buy   : route output to the router itself, then multicall(unwrapWETH9) sends ETH to user.
    // ERC20→ERC20: direct exactInputSingle with recipient=user.
    let calldata: Hex;

    if (isNativeETHBuy) {
      const swapCall = encodeFunctionData({
        abi: SWAP_ROUTER02_ABI,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: effectiveSellAddress,
            tokenOut: effectiveBuyAddress,
            fee: feeTier,
            // Output WETH stays in the router so the next call can unwrap it.
            recipient: dexConfig.routerAddress,
            amountIn: sellAmountRaw,
            amountOutMinimum: minimumBuyAmountRaw,
            sqrtPriceLimitX96: 0n,
          },
        ],
      }) as Hex;
      const unwrapCall = encodeFunctionData({
        abi: SWAP_ROUTER02_ABI,
        functionName: "unwrapWETH9",
        args: [minimumBuyAmountRaw, account],
      }) as Hex;
      calldata = encodeFunctionData({
        abi: SWAP_ROUTER02_ABI,
        functionName: "multicall",
        args: [[swapCall, unwrapCall]],
      }) as Hex;
    } else {
      calldata = encodeFunctionData({
        abi: SWAP_ROUTER02_ABI,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: effectiveSellAddress,
            tokenOut: effectiveBuyAddress,
            fee: feeTier,
            recipient: account,
            amountIn: sellAmountRaw,
            amountOutMinimum: minimumBuyAmountRaw,
            sqrtPriceLimitX96: 0n,
          },
        ],
      }) as Hex;
    }

    // ── 7. Return quote ───────────────────────────────────────────────────────
    const now = Date.now();
    return {
      quoteId: `uniswap-v3-${networkKey}-${sellToken.symbol}-${buyToken.symbol}-${now}`,
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
        routeKind: isNativeETHSell
          ? "v3_eth_exact_input_single"
          : isNativeETHBuy
            ? "v3_exact_input_single_unwrap"
            : "v3_exact_input_single",
      },
    };
  }
}
