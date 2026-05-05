import type { TokenMetadata } from "@/src/features/assets/types/token";
import type {
  CreateWalletTransactionInput,
  WalletTransaction,
} from "@/src/features/transactions";
import type { PreparedSmartAccountExecution } from "@/src/features/wallet/types/execution";
import type { SupportedChainId } from "@/src/integration/chains";
import type { NetworkKey } from "@/src/integration/networks";
import type { Address, Hex } from "viem";

export type SwapIntent = {
  userId: string;
  aaWalletId: string;
  walletAddress: Address;
  chainId: SupportedChainId;
  networkKey: NetworkKey;
  sellToken: TokenMetadata;
  buyToken: TokenMetadata;
  sellAmountDecimal: string;
  slippageBps: number;
};

export type SwapQuote = {
  quoteId: string;
  chainId: SupportedChainId;
  networkKey: NetworkKey;
  sellToken: TokenMetadata;
  buyToken: TokenMetadata;
  sellAmountRaw: bigint;
  estimatedBuyAmountRaw: bigint;
  minimumBuyAmountRaw: bigint;
  slippageBps: number;
  priceImpactBps?: number;
  spender: Address;
  target: Address;
  value: bigint;
  calldata: Hex;
  provider: string;
  /** Alias for provider — use in network-aware code. */
  providerId?: string;
  expiresAt?: string;
  routeMetadata?: Record<string, unknown>;
};

export type SwapWarningLevel = "info" | "warning";

export type SwapWarning = {
  code:
    | "quote_expires_soon"
    | "price_impact_high"
    | "approval_required"
    | "provider_notice";
  level: SwapWarningLevel;
  message: string;
};

export type SwapPlan = {
  intent: SwapIntent;
  quote: SwapQuote;
  sellBalanceRaw: bigint;
  currentAllowanceRaw: bigint | null;
  approvalRequired: boolean;
  approvalExecution?: PreparedSmartAccountExecution;
  swapExecution: PreparedSmartAccountExecution;
  approvalTransactionInput?: CreateWalletTransactionInput;
  swapTransactionInput: CreateWalletTransactionInput;
  warnings: SwapWarning[];
};

export type SwapExecutionResult = {
  intentId: string;
  approvalTransactionId?: string;
  swapTransactionId?: string;
  status: "pending" | "confirmed" | "failed" | "cancelled";
  approval?: WalletTransaction;
  swap?: WalletTransaction;
  error?: string;
};
