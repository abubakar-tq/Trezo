import type { TokenMetadata } from "@/src/features/assets/types/token";
import type {
  WalletTransaction,
  WalletTransactionStatus,
} from "@/src/features/transactions/types/transaction";
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

export type TransactionStatus = WalletTransactionStatus;
export type TransactionRecord = WalletTransaction;

export type SendExecutionResult = {
  transactionId: string;
  status: WalletTransactionStatus;
  prepared?: PreparedSend;
  preparedUserOperation?: PreparedUserOperation;
  signedUserOperation?: SignedUserOperation;
  userOpHash?: Hex;
  transactionHash?: Hex;
  blockNumber?: bigint;
  error?: string;
};
