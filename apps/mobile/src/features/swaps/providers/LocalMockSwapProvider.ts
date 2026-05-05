import { getPublicClient } from "@/src/integration/viem/clients";
import { getDeployment } from "@/src/integration/viem/deployments";
import type { SupportedChainId } from "@/src/integration/chains";
import type { SwapRouteProvider, SwapQuoteRequest } from "@/src/features/swaps/providers/SwapRouteProvider";
import type { SwapQuote } from "@/src/features/swaps/types/swap";
import { encodeFunctionData, type Address, type Hex } from "viem";

const MOCK_SWAP_ROUTER_ABI = [
  {
    type: "function",
    name: "getQuote",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "swapExactInput",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minimumAmountOut", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

const DEFAULT_SLIPPAGE_DENOMINATOR = 10_000n;

const normalizeAddress = (value: string): Address => value as Address;

const resolveConfiguredTokens = (chainId: SupportedChainId): Record<string, Address> => {
  const deployment = getDeployment(chainId);
  const configured = deployment?.mockSwapTokens;
  if (!configured) return {};

  const tokens: Record<string, Address> = {};
  for (const [symbol, addr] of Object.entries(configured)) {
    if (!addr) continue;
    tokens[symbol.toUpperCase()] = normalizeAddress(addr);
  }
  return tokens;
};

const resolveRouter = (chainId: SupportedChainId): Address | null => {
  const router = getDeployment(chainId)?.mockSwapRouter;
  return router ?? null;
};

export class LocalMockSwapProvider implements SwapRouteProvider {
  readonly id = "local-mock-router";
  readonly label = "Local Mock Router";

  supportsChain(chainId: SupportedChainId): boolean {
    if (chainId !== 31337) return false;
    const router = resolveRouter(chainId);
    const tokens = resolveConfiguredTokens(chainId);
    return Boolean(router && Object.keys(tokens).length >= 2);
  }

  supportsNetwork(networkKey: import("@/src/integration/networks").NetworkKey): boolean {
    return networkKey === "anvil-local";
  }

  async supportsPair(request: SwapQuoteRequest): Promise<boolean> {
    if (!this.supportsChain(request.chainId)) return false;
    if (request.sellToken.type !== "erc20" || request.buyToken.type !== "erc20") return false;

    const configured = Object.values(resolveConfiguredTokens(request.chainId)).map((value) => value.toLowerCase());
    const sell = request.sellToken.address.toLowerCase();
    const buy = request.buyToken.address.toLowerCase();

    return configured.includes(sell) && configured.includes(buy) && sell !== buy;
  }

  async getQuote(request: SwapQuoteRequest): Promise<SwapQuote> {
    const router = resolveRouter(request.chainId);
    if (!router) {
      throw new Error(`No local mock swap router configured for chain ${request.chainId}.`);
    }

    if (!(await this.supportsPair(request))) {
      throw new Error("Local mock provider does not support this token pair.");
    }

    const client = getPublicClient(request.chainId);
    let estimatedBuyAmountRaw: bigint;

    try {
      estimatedBuyAmountRaw = await client.readContract({
        address: router,
        abi: MOCK_SWAP_ROUTER_ABI,
        functionName: "getQuote",
        args: [request.sellToken.address as Address, request.buyToken.address as Address, request.sellAmountRaw],
      }) as bigint;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch local mock quote from router: ${message}`);
    }

    const minimumBuyAmountRaw =
      (estimatedBuyAmountRaw * (DEFAULT_SLIPPAGE_DENOMINATOR - BigInt(request.slippageBps)))
      / DEFAULT_SLIPPAGE_DENOMINATOR;

    if (minimumBuyAmountRaw <= 0n) {
      throw new Error("Local mock quote computed an invalid minimum buy amount.");
    }

    const calldata = encodeFunctionData({
      abi: MOCK_SWAP_ROUTER_ABI,
      functionName: "swapExactInput",
      args: [
        request.sellToken.address as Address,
        request.buyToken.address as Address,
        request.sellAmountRaw,
        minimumBuyAmountRaw,
        request.account,
      ],
    }) as Hex;

    const now = Date.now();
    return {
      quoteId: `local-${request.chainId}-${request.sellToken.symbol}-${request.buyToken.symbol}-${now}`,
      chainId: request.chainId,
      networkKey: request.networkKey,
      sellToken: request.sellToken,
      buyToken: request.buyToken,
      sellAmountRaw: request.sellAmountRaw,
      estimatedBuyAmountRaw,
      minimumBuyAmountRaw,
      slippageBps: request.slippageBps,
      spender: router,
      target: router,
      value: 0n,
      calldata,
      provider: this.id,
      expiresAt: new Date(now + 30_000).toISOString(),
      routeMetadata: {
        providerLabel: this.label,
        swapKind: "local_mock",
      },
    };
  }
}

