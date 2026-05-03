import type { TokenMetadata } from "@/src/features/assets/types/token";
import type { PreparedSmartAccountExecution, PreparedUserOperation, SignedUserOperation } from "@/src/features/wallet/types/execution";
import type { SupportedChainId } from "@/src/integration/chains";
import type { Address, Hex } from "viem";

export type SendFeeMode = "sponsored" | "wallet_paid";

export type SendIntent = {
  userId: string;
  aaWalletId: string;
  walletAddress: Address;
  chainId: SupportedChainId;
  token: TokenMetadata;
  recipient: string;
  amountDecimal: string;
  memo?: string;
};

export type SendValidationErrorCode =
  | "wallet_not_found"
  | "wallet_not_deployed"
  | "wallet_mismatch"
  | "chain_disabled"
  | "chain_missing_deployment"
  | "recipient_invalid"
  | "token_invalid"
  | "amount_invalid"
  | "amount_zero"
  | "insufficient_balance"
  | "passkey_missing";

export type SendValidationError = {
  code: SendValidationErrorCode;
  field: "recipient" | "amount" | "token" | "chain" | "wallet" | "passkey";
  message: string;
};

export type SendValidationResult = {
  isValid: boolean;
  errors: SendValidationError[];
  normalized?: {
    walletAddress: Address;
    recipient: Address;
    token: TokenMetadata;
    amountRaw: bigint;
    balanceRaw: bigint;
    spendableRaw: bigint;
    feeMode: SendFeeMode;
  };
};

export type PreparedSend = {
  intent: SendIntent;
  validation: NonNullable<SendValidationResult["normalized"]>;
  execution: PreparedSmartAccountExecution;
  targetAddress: Address;
  valueRaw: bigint;
  calldata: Hex;
};

export type TransactionStatus =
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

export type TransactionRecord = {
  id: string;
  userId: string;
  aaWalletId?: string | null;
  walletAddress: Address;
  chainId: number;
  type: "send_native" | "send_erc20" | "swap" | "bridge" | "contract_interaction";
  status: TransactionStatus;
  tokenType: "native" | "erc20";
  tokenAddress?: Address | null;
  tokenSymbol: string;
  tokenDecimals: number;
  fromAddress: Address;
  toAddress: Address;
  amountRaw: string;
  amountDisplay: string;
  targetAddress: Address;
  valueRaw: string;
  calldata: Hex;
  userOpHash?: Hex | null;
  transactionHash?: Hex | null;
  blockNumber?: bigint | null;
  entryPoint?: Address | null;
  bundlerUrl?: string | null;
  paymasterUsed?: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  confirmedAt?: string | null;
};

export type SendExecutionResult = {
  transactionId: string;
  status: TransactionStatus;
  prepared?: PreparedSend;
  preparedUserOperation?: PreparedUserOperation;
  signedUserOperation?: SignedUserOperation;
  userOpHash?: Hex;
  transactionHash?: Hex;
  blockNumber?: bigint;
  error?: string;
};
