/**
 * bridge.ts
 *
 * Types for the cross-chain bridge / cross-chain swap flow.
 *
 * The bridge deposits `inputToken` into the Across V3 SpokePool on the source
 * chain. Across relays the deposit to the destination CrossChainExecutor,
 * which forwards `outputToken` to the user's smart account (or runs an
 * additional Uniswap V3 swap before forwarding — see ADR 0007).
 */

import type { TokenMetadata } from "@/src/features/assets/types/token";
import type {
  CreateWalletTransactionInput,
  WalletTransaction,
} from "@/src/features/transactions";
import type { PreparedSmartAccountExecution } from "@/src/features/wallet/types/execution";
import type { SupportedChainId } from "@/src/integration/chains";
import type { NetworkKey } from "@/src/integration/networks";
import type { Address, Hex } from "viem";

export type BridgeIntent = {
  userId: string;
  aaWalletId: string;
  /** Same on every chain — smart account is deployed deterministically. */
  walletAddress: Address;

  /** Source chain (where deposit happens). */
  sourceNetworkKey: NetworkKey;
  sourceChainId: SupportedChainId;

  /** Destination chain (where the executor delivers the output). */
  destNetworkKey: NetworkKey;
  destChainId: SupportedChainId;

  /** Token deposited into the SpokePool on the source chain. */
  inputToken: TokenMetadata;
  /** Amount of `inputToken` to deposit, parsed against its decimals. */
  inputAmountDecimal: string;

  /** Token the user wants on the destination chain. */
  outputToken: TokenMetadata;

  /**
   * Slippage tolerance for the destination-side swap when outputToken differs
   * from the bridged token. Unused when inputToken and outputToken are the
   * canonical pair for the route (no dest-side swap needed).
   */
  slippageBps: number;
};

export type BridgeQuote = {
  quoteId: string;
  sourceNetworkKey: NetworkKey;
  sourceChainId: SupportedChainId;
  destNetworkKey: NetworkKey;
  destChainId: SupportedChainId;

  inputToken: TokenMetadata;
  outputToken: TokenMetadata;

  /** What the depositor sends. */
  inputAmountRaw: bigint;
  /** What the recipient receives on the destination chain (after relayer + LP fee). */
  outputAmountRaw: bigint;
  /** Total fee in basis points, applied to inputAmountRaw. */
  feeBps: number;

  /** Across-protocol-mandated fields for the depositV3 call. */
  quoteTimestamp: number; // uint32
  fillDeadline: number; // uint32
  exclusivityDeadline: number; // uint32 — 0 means no exclusivity
  exclusiveRelayer: Address; // address(0) when no exclusivity

  /** The Across V3 SpokePool we're depositing into. */
  spokePool: Address;
  /** Trezo CrossChainExecutor on the destination chain — only set for cross-chain swap. */
  destExecutor?: Address;
  /** Final recipient on the destination chain: user wallet for same-asset, executor for cross-chain swap. */
  destRecipient: Address;

  /** True when outputToken differs from the canonical bridged token — executor performs a dest-side swap. */
  destSwapRequired: boolean;

  expiresAt: string;
  routeMetadata?: Record<string, unknown>;
};

export type BridgeWarning = {
  code:
    | "approval_required"
    | "quote_expires_soon"
    | "destination_swap"
    | "provider_notice";
  level: "info" | "warning";
  message: string;
};

export type BridgePlan = {
  intent: BridgeIntent;
  quote: BridgeQuote;
  sourceBalanceRaw: bigint;
  currentAllowanceRaw: bigint | null;
  approvalRequired: boolean;
  approvalExecution?: PreparedSmartAccountExecution;
  bridgeExecution: PreparedSmartAccountExecution;
  approvalTransactionInput?: CreateWalletTransactionInput;
  bridgeTransactionInput: CreateWalletTransactionInput;
  /** Encoded Across BridgeMessage carrying the destination-side swap params. */
  bridgeMessage: Hex;
  warnings: BridgeWarning[];
  /** Epoch ms when the underlying quote was obtained. Used for staleness checks. */
  quotedAt: number;
};

export type BridgeExecutionResult = {
  intentId: string;
  approvalTransactionId?: string;
  bridgeTransactionId?: string;
  status: "pending" | "confirmed" | "failed" | "cancelled";
  approval?: WalletTransaction;
  bridge?: WalletTransaction;
  error?: string;
};
