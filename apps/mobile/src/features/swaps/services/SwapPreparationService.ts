/**
 * SwapPreparationService.ts
 *
 * Prepares a complete SwapPlan from a SwapIntent:
 *   - Validates the network, wallet, and tokens.
 *   - Fetches a real quote from the appropriate provider.
 *   - Checks and prepares token approval if needed.
 *   - Builds transaction draft inputs.
 *
 * Network-key-aware: resolves deployment, tokens, balances, and quotes
 * by networkKey when present; falls back to chainId for legacy networks.
 */

import { BalanceService } from "@/src/features/assets/services/BalanceService";
import { TokenRegistryService } from "@/src/features/assets/services/TokenRegistryService";
import type { TokenMetadata } from "@/src/features/assets/types/token";
import { AllowanceService } from "@/src/features/swaps/services/AllowanceService";
import { SwapQuoteService } from "@/src/features/swaps/services/SwapQuoteService";
import type { SwapIntent, SwapPlan, SwapWarning } from "@/src/features/swaps/types/swap";
import type { CreateWalletTransactionInput } from "@/src/features/transactions";
import WalletPersistenceService from "@/src/features/wallet/services/SupabaseWalletService";
import { getNetworkConfig } from "@/src/integration/networks";
import { getDeploymentForNetwork } from "@/src/integration/viem/deployments";
import { formatUnits, isAddress, parseUnits, type Address } from "viem";

const normalizeTokenAddress = (token: TokenMetadata): string =>
  token.type === "native" ? "native" : token.address.toLowerCase();

const ensureKnownToken = (intent: SwapIntent, token: TokenMetadata): TokenMetadata =>
  TokenRegistryService.assertTokenOnNetwork(intent.networkKey, token);

const ensureWalletConsistency = async (intent: SwapIntent, walletService: WalletPersistenceService): Promise<void> => {
  // Try to get wallet by networkKey first, fall back to chainId
  let wallet = null;
  try {
    wallet = await walletService.getAAWalletForNetwork?.(intent.userId, intent.networkKey);
  } catch {
    // Method may not exist yet
  }
  if (!wallet) {
    wallet = await walletService.getAAWalletForChain(intent.userId, intent.chainId);
  }

  if (!wallet) {
    throw new Error(`No smart account wallet found for network ${intent.networkKey}.`);
  }

  if (wallet.id !== intent.aaWalletId) {
    throw new Error("Swap intent wallet does not match the user's wallet for this network.");
  }

  if (!wallet.is_deployed) {
    throw new Error("Smart account is not deployed on this network.");
  }

  if (wallet.predicted_address.toLowerCase() !== intent.walletAddress.toLowerCase()) {
    throw new Error("Swap intent wallet address does not match wallet metadata.");
  }
};

const buildSwapMetadata = (plan: {
  sellToken: TokenMetadata;
  buyToken: TokenMetadata;
  sellAmountRaw: bigint;
  estimatedBuyAmountRaw: bigint;
  minimumBuyAmountRaw: bigint;
  slippageBps: number;
  priceImpactBps?: number;
  provider: string;
  spender: Address;
  quoteId: string;
  expiresAt?: string;
  routeMetadata?: Record<string, unknown>;
}) => ({
  sellToken: plan.sellToken,
  buyToken: plan.buyToken,
  sellAmountRaw: plan.sellAmountRaw.toString(),
  estimatedBuyAmountRaw: plan.estimatedBuyAmountRaw.toString(),
  minimumBuyAmountRaw: plan.minimumBuyAmountRaw.toString(),
  slippageBps: plan.slippageBps,
  priceImpactBps: plan.priceImpactBps,
  provider: plan.provider,
  spender: plan.spender,
  quoteId: plan.quoteId,
  expiresAt: plan.expiresAt,
  routeMetadata: plan.routeMetadata,
});

const toApprovalDraftInput = (intent: SwapIntent, approvalExecutionData: {
  spender: Address;
  token: TokenMetadata;
  amountRaw: bigint;
  calldata: `0x${string}`;
}): CreateWalletTransactionInput => ({
  userId: intent.userId,
  aaWalletId: intent.aaWalletId,
  walletAddress: intent.walletAddress,
  chainId: intent.chainId,
  networkKey: intent.networkKey,
  type: "token_approval",
  direction: "outgoing",
  tokenType: "erc20",
  tokenAddress: approvalExecutionData.token.type === "erc20" ? approvalExecutionData.token.address : null,
  tokenSymbol: approvalExecutionData.token.symbol,
  tokenDecimals: approvalExecutionData.token.decimals,
  fromAddress: intent.walletAddress,
  toAddress: approvalExecutionData.spender,
  targetAddress: approvalExecutionData.token.type === "erc20" ? approvalExecutionData.token.address : null,
  valueRaw: "0",
  calldata: approvalExecutionData.calldata,
  amountRaw: approvalExecutionData.amountRaw.toString(),
  amountDisplay: formatUnits(approvalExecutionData.amountRaw, approvalExecutionData.token.decimals),
  metadata: {
    spender: approvalExecutionData.spender,
    approvalType: "exact",
  },
});

const toSwapDraftInput = (intent: SwapIntent, swapData: {
  target: Address;
  value: bigint;
  calldata: `0x${string}`;
  sellAmountRaw: bigint;
  metadata: Record<string, unknown>;
}): CreateWalletTransactionInput => ({
  userId: intent.userId,
  aaWalletId: intent.aaWalletId,
  walletAddress: intent.walletAddress,
  chainId: intent.chainId,
  networkKey: intent.networkKey,
  type: "swap",
  direction: "outgoing",
  tokenType: intent.sellToken.type,
  tokenAddress: intent.sellToken.type === "erc20" ? intent.sellToken.address : null,
  tokenSymbol: intent.sellToken.symbol,
  tokenDecimals: intent.sellToken.decimals,
  fromAddress: intent.walletAddress,
  toAddress: swapData.target,
  targetAddress: swapData.target,
  valueRaw: swapData.value.toString(),
  calldata: swapData.calldata,
  amountRaw: swapData.sellAmountRaw.toString(),
  amountDisplay: formatUnits(swapData.sellAmountRaw, intent.sellToken.decimals),
  metadata: swapData.metadata,
});

export class SwapPreparationService {
  private static readonly walletService = new WalletPersistenceService();

  static async prepareSwap(intent: SwapIntent): Promise<SwapPlan> {
    // ── 1. Validate network ───────────────────────────────────────────────────
    const network = getNetworkConfig(intent.networkKey);
    if (!network.isEnabled) {
      throw new Error(`Network ${network.displayName} (${intent.networkKey}) is disabled.`);
    }

    if (network.chainId !== intent.chainId) {
      throw new Error(
        `Intent chainId (${intent.chainId}) does not match network chainId (${network.chainId}) for ${intent.networkKey}.`
      );
    }

    const deployment = getDeploymentForNetwork(intent.networkKey);
    if (!deployment?.entryPoint || !deployment?.accountFactory) {
      throw new Error(`Deployment addresses are missing for network ${intent.networkKey}.`);
    }

    // ── 2. Validate wallet ────────────────────────────────────────────────────
    await ensureWalletConsistency(intent, this.walletService);

    // ── 3. Validate tokens ────────────────────────────────────────────────────
    if (intent.sellToken.chainId !== intent.chainId || intent.buyToken.chainId !== intent.chainId) {
      throw new Error("Swap tokens must match the selected chain.");
    }

    const sellToken = ensureKnownToken(intent, intent.sellToken);
    const buyToken = ensureKnownToken(intent, intent.buyToken);

    if (normalizeTokenAddress(sellToken) === normalizeTokenAddress(buyToken)) {
      throw new Error("Sell and buy tokens must be different.");
    }

    if (!Number.isInteger(intent.slippageBps) || intent.slippageBps <= 0 || intent.slippageBps > 5_000) {
      throw new Error("Slippage must be an integer between 1 and 5000 bps.");
    }

    // ── 4. Check sell amount and balance ──────────────────────────────────────
    const sellAmountRaw = parseUnits(intent.sellAmountDecimal, sellToken.decimals);
    if (sellAmountRaw <= 0n) {
      throw new Error("Sell amount must be greater than zero.");
    }

    const sellBalanceRaw = await BalanceService.getBalance({
      chainId: intent.chainId,
      walletAddress: intent.walletAddress,
      token: sellToken,
    });

    if (sellBalanceRaw < sellAmountRaw) {
      throw new Error("Insufficient sell token balance.");
    }

    // ── 5. Get quote ──────────────────────────────────────────────────────────
    const quote = await SwapQuoteService.getQuote({
      networkKey: intent.networkKey,
      chainId: intent.chainId,
      account: intent.walletAddress,
      sellToken,
      buyToken,
      sellAmountRaw,
      slippageBps: intent.slippageBps,
    });

    if (!isAddress(quote.target) || !isAddress(quote.spender)) {
      throw new Error("Quote returned invalid spender or target address.");
    }

    if (quote.calldata === "0x") {
      throw new Error("Quote returned empty calldata.");
    }

    if (quote.minimumBuyAmountRaw > quote.estimatedBuyAmountRaw) {
      throw new Error("Quote minimum output exceeds estimated output.");
    }

    // ── 6. Check allowance ────────────────────────────────────────────────────
    const allowanceCheck = await AllowanceService.isApprovalRequired({
      token: sellToken,
      sellAmountRaw,
      owner: intent.walletAddress,
      spender: quote.spender,
      chainId: intent.chainId,
      networkKey: intent.networkKey,
    });

    let approvalExecution = undefined;
    let approvalTransactionInput = undefined;

    if (allowanceCheck.required) {
      const prepared = AllowanceService.prepareApprovalExecution({
        chainId: intent.chainId,
        networkKey: intent.networkKey,
        account: intent.walletAddress,
        token: sellToken,
        spender: quote.spender,
        amountRaw: sellAmountRaw,
      });
      approvalExecution = prepared;

      approvalTransactionInput = toApprovalDraftInput(intent, {
        spender: quote.spender,
        token: sellToken,
        amountRaw: sellAmountRaw,
        calldata: prepared.data,
      });
    }

    const swapExecution = {
      chainId: intent.chainId,
      networkKey: intent.networkKey,
      account: intent.walletAddress,
      target: quote.target,
      value: quote.value,
      data: quote.calldata,
      operationLabel: "swap",
      riskLevel: "medium" as const,
      metadata: {
        quoteId: quote.quoteId,
        provider: quote.provider,
        spender: quote.spender,
        sellToken: quote.sellToken,
        buyToken: quote.buyToken,
        sellAmountRaw: quote.sellAmountRaw.toString(),
        minimumBuyAmountRaw: quote.minimumBuyAmountRaw.toString(),
      },
    };

    const swapTransactionInput = toSwapDraftInput(intent, {
      target: quote.target,
      value: quote.value,
      calldata: quote.calldata,
      sellAmountRaw,
      metadata: buildSwapMetadata({
        sellToken,
        buyToken,
        sellAmountRaw,
        estimatedBuyAmountRaw: quote.estimatedBuyAmountRaw,
        minimumBuyAmountRaw: quote.minimumBuyAmountRaw,
        slippageBps: quote.slippageBps,
        priceImpactBps: quote.priceImpactBps,
        provider: quote.provider,
        spender: quote.spender,
        quoteId: quote.quoteId,
        expiresAt: quote.expiresAt,
        routeMetadata: quote.routeMetadata,
      }),
    });

    const warnings: SwapWarning[] = [];
    if (allowanceCheck.required) {
      warnings.push({
        code: "approval_required",
        level: "info",
        message: `Approval required for ${sellToken.symbol} before swap execution.`,
      });
    }

    if (quote.expiresAt) {
      const expiresAtMs = new Date(quote.expiresAt).getTime();
      if (Number.isFinite(expiresAtMs) && expiresAtMs - Date.now() < 30_000) {
        warnings.push({
          code: "quote_expires_soon",
          level: "warning",
          message: "Quote expires soon. Refresh quote if signing is delayed.",
        });
      }
    }

    return {
      intent: {
        ...intent,
        sellToken,
        buyToken,
      },
      quote,
      sellBalanceRaw,
      currentAllowanceRaw: allowanceCheck.allowanceRaw,
      approvalRequired: allowanceCheck.required,
      approvalExecution,
      swapExecution,
      approvalTransactionInput,
      swapTransactionInput,
      warnings,
    };
  }
}
