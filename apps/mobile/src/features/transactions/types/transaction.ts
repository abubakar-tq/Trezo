import type { NetworkKey } from "@/src/integration/networks";
import type { Address, Hex } from "viem";

export type WalletTransactionType =
  | "send_native"
  | "send_erc20"
  | "token_approval"
  | "swap"
  | "bridge"
  | "cross_chain_swap"
  | "module_install"
  | "recovery"
  | "contract_interaction";

export type WalletTransactionStatus =
  | "draft"
  | "prepared"
  | "signing"
  | "signed"
  | "submitted"
  | "pending"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "dropped";

export type WalletTransactionDirection = "incoming" | "outgoing" | "self";

export type WalletTransactionFeeMode =
  | "sponsored"
  | "wallet_native"
  | "token_paymaster"
  | "unknown";

export type WalletTransactionTokenType = "native" | "erc20";

export type WalletTransaction = {
  id: string;
  userId: string;
  aaWalletId: string | null;
  walletAddress: Address;
  chainId: number;
  networkKey: NetworkKey;
  type: WalletTransactionType;
  status: WalletTransactionStatus;
  direction: WalletTransactionDirection;
  tokenType: WalletTransactionTokenType | null;
  tokenAddress: Address | null;
  tokenSymbol: string | null;
  tokenDecimals: number | null;
  fromAddress: Address | null;
  toAddress: Address | null;
  amountRaw: string | null;
  amountDisplay: string | null;
  targetAddress: Address | null;
  valueRaw: string | null;
  calldata: Hex | null;
  userOpHash: Hex | null;
  transactionHash: Hex | null;
  blockNumber: bigint | null;
  entryPoint: Address | null;
  bundlerUrl: string | null;
  paymasterUsed: boolean;
  feeMode: WalletTransactionFeeMode | null;
  intentId: string | null;
  parentTransactionId: string | null;
  sequenceIndex: number | null;
  metadata: Record<string, unknown>;
  errorCode: string | null;
  errorMessage: string | null;
  debugContext: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  preparedAt: string | null;
  signingStartedAt: string | null;
  signedAt: string | null;
  submittedAt: string | null;
  confirmedAt: string | null;
  failedAt: string | null;
};

export type CreateWalletTransactionInput = {
  userId: string;
  aaWalletId?: string | null;
  walletAddress: Address;
  chainId: number;
  networkKey?: NetworkKey;
  type: WalletTransactionType;
  direction?: WalletTransactionDirection;
  tokenType?: WalletTransactionTokenType | null;
  tokenAddress?: Address | null;
  tokenSymbol?: string | null;
  tokenDecimals?: number | null;
  fromAddress?: Address | null;
  toAddress?: Address | null;
  amountRaw?: string | null;
  amountDisplay?: string | null;
  targetAddress?: Address | null;
  valueRaw?: string | null;
  calldata?: Hex | null;
  entryPoint?: Address | null;
  bundlerUrl?: string | null;
  paymasterUsed?: boolean;
  feeMode?: WalletTransactionFeeMode | null;
  intentId?: string | null;
  parentTransactionId?: string | null;
  sequenceIndex?: number | null;
  metadata?: Record<string, unknown>;
  debugContext?: Record<string, unknown> | null;
};

export type WalletTransactionTransitionPatch = {
  type?: WalletTransactionType;
  direction?: WalletTransactionDirection;
  tokenType?: WalletTransactionTokenType | null;
  tokenAddress?: Address | null;
  tokenSymbol?: string | null;
  tokenDecimals?: number | null;
  fromAddress?: Address | null;
  toAddress?: Address | null;
  amountRaw?: string | null;
  amountDisplay?: string | null;
  targetAddress?: Address | null;
  valueRaw?: string | null;
  calldata?: Hex | null;
  userOpHash?: Hex | null;
  transactionHash?: Hex | null;
  blockNumber?: bigint | null;
  entryPoint?: Address | null;
  bundlerUrl?: string | null;
  paymasterUsed?: boolean;
  feeMode?: WalletTransactionFeeMode | null;
  intentId?: string | null;
  parentTransactionId?: string | null;
  sequenceIndex?: number | null;
  metadata?: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
  debugContext?: Record<string, unknown> | null;
};
