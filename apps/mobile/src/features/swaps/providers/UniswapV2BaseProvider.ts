/**
 * UniswapV2BaseProvider.ts
 *
 * Swap route provider that uses the Uniswap V2 interface on Base.
 * Pricing via router.getAmountsOut() — a pure view function, no simulation.
 *
 * Key advantages over the V3 QuoterV2 provider:
 *   - Single RPC call for pricing (no simulateContract overhead)
 *   - Native ETH supported directly: swapExactETHForTokens
 *   - Works with any V2-compatible router on the fork
 *
 * Supported networks: base-mainnet-fork, base-mainnet
 *
 * Addresses (Uniswap V2 deployment on Base):
 *   Factory:  0x8909Dc15e40173Ff4699343b6eB8132c65e18eC
 *   Router02: 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24
 *
 * Verify on your fork:
 *   cast code 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24 --rpc-url $FORK_RPC_URL
 */

import type { SwapRouteProvider, SwapQuoteRequest } from "@/src/features/swaps/providers/SwapRouteProvider";
import type { SwapQuote } from "@/src/features/swaps/types/swap";
import type { SupportedChainId } from "@/src/integration/chains";
import type { NetworkKey } from "@/src/integration/networks";
import { getPublicClientForNetwork } from "@/src/integration/viem/clients";
import { encodeFunctionData, type Address, type Hex } from "viem";

// ─── V2 addresses on Base ─────────────────────────────────────────────────────

const V2_CONFIGS: Partial<Record<NetworkKey, {
  routerAddress: Address;
  wethAddress: Address;
}>> = {
  "base-mainnet-fork": {
    routerAddress: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24" as Address,
    wethAddress: "0x4200000000000000000000000000000000000006" as Address,
  },
  "base-mainnet": {
    routerAddress: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24" as Address,
    wethAddress: "0x4200000000000000000000000000000000000006" as Address,
  },
};

const SUPPORTED_NETWORKS: NetworkKey[] = ["base-mainnet-fork", "base-mainnet"];

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const ROUTER_V2_ABI = [
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactETHForTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

// ─── Provider ─────────────────────────────────────────────────────────────────

export class UniswapV2BaseProvider implements SwapRouteProvider {
  readonly id = "uniswap-v2-base";
  readonly label = "Uniswap V2";

  supportsChain(_chainId: SupportedChainId): boolean {
    return false;
  }

  supportsNetwork(networkKey: NetworkKey): boolean {
    return SUPPORTED_NETWORKS.includes(networkKey);
  }

  async supportsPair(request: SwapQuoteRequest): Promise<boolean> {
    if (!this.supportsNetwork(request.networkKey)) return false;
    if (!V2_CONFIGS[request.networkKey]) return false;
    // ERC20 → native ETH not yet supported (requires unwrap step)
    if (request.buyToken.type !== "erc20") return false;
    // Sell token can be native ETH or ERC20
    return true;
  }

  async getQuote(request: SwapQuoteRequest): Promise<SwapQuote> {
    const { networkKey, chainId, account, sellToken, buyToken, sellAmountRaw, slippageBps } = request;

    const config = V2_CONFIGS[networkKey];
    if (!config) {
      throw new Error(`UniswapV2BaseProvider: no config for network ${networkKey}.`);
    }
    if (buyToken.type !== "erc20") {
      throw new Error("UniswapV2BaseProvider does not support ERC20 → native ETH swaps yet.");
    }
    if (sellAmountRaw <= 0n) {
      throw new Error("Sell amount must be greater than zero.");
    }

    const { routerAddress, wethAddress } = config;
    const isNativeETHSell = sellToken.type === "native";

    // For native ETH: path = [WETH, buyToken]
    // For ERC20: path = [sellToken, buyToken]  (direct pair — extend for multi-hop if needed)
    const effectiveSellAddress: Address = isNativeETHSell
      ? wethAddress
      : (sellToken.address as Address);

    const path: readonly Address[] = [effectiveSellAddress, buyToken.address as Address];

    const client = getPublicClientForNetwork(networkKey);

    // ── Pricing via getAmountsOut — single view call, no simulation ───────────
    let estimatedBuyAmountRaw: bigint;

    try {
      const amounts = await client.readContract({
        address: routerAddress,
        abi: ROUTER_V2_ABI,
        functionName: "getAmountsOut",
        args: [sellAmountRaw, path],
      }) as bigint[];

      // amounts = [amountIn, amountOut] for a 2-hop path
      estimatedBuyAmountRaw = amounts[amounts.length - 1];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `UniswapV2 getAmountsOut failed for ${sellToken.symbol}→${buyToken.symbol}: ${message}. ` +
        `Verify 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24 exists on the fork.`
      );
    }

    if (!estimatedBuyAmountRaw || estimatedBuyAmountRaw <= 0n) {
      throw new Error("V2 returned zero output. No liquidity for this pair on the fork.");
    }

    // ── Slippage ───────────────────────────────────────────────────────────────
    const minimumBuyAmountRaw =
      (estimatedBuyAmountRaw * BigInt(10_000 - slippageBps)) / 10_000n;

    if (minimumBuyAmountRaw <= 0n) {
      throw new Error("Slippage is too high — minimum buy amount rounds to zero.");
    }

    // ── Calldata ───────────────────────────────────────────────────────────────
    // Deadline: 30 minutes from now
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1_800);

    let calldata: Hex;

    if (isNativeETHSell) {
      // Native ETH → ERC20: router wraps ETH to WETH automatically
      calldata = encodeFunctionData({
        abi: ROUTER_V2_ABI,
        functionName: "swapExactETHForTokens",
        args: [minimumBuyAmountRaw, path, account, deadline],
      }) as Hex;
    } else {
      calldata = encodeFunctionData({
        abi: ROUTER_V2_ABI,
        functionName: "swapExactTokensForTokens",
        args: [sellAmountRaw, minimumBuyAmountRaw, path, account, deadline],
      }) as Hex;
    }

    const now = Date.now();
    return {
      quoteId: `uniswap-v2-base-${networkKey}-${sellToken.symbol}-${buyToken.symbol}-${now}`,
      chainId,
      networkKey,
      sellToken,
      buyToken,
      sellAmountRaw,
      estimatedBuyAmountRaw,
      minimumBuyAmountRaw,
      slippageBps,
      spender: routerAddress,
      target: routerAddress,
      value: isNativeETHSell ? sellAmountRaw : 0n,
      calldata,
      provider: this.id,
      providerId: this.id,
      expiresAt: new Date(now + 60_000).toISOString(),
      routeMetadata: {
        dexId: "uniswap_v2",
        dexLabel: this.label,
        routerAddress,
        path: path.join(" → "),
        routeKind: isNativeETHSell ? "v2_exact_eth_for_tokens" : "v2_exact_tokens_for_tokens",
      },
    };
  }
}
