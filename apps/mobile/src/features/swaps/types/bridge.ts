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
  /**
   * The user's smart-account address on the SOURCE chain (depositor).
   * Same as destWalletAddress on portable chains with matching passkeys.
   */
  walletAddress: Address;
  /**
   * The user's smart-account address on the DESTINATION chain (recipient).
   * For portable deterministic deploys with the same passkey this matches
   * walletAddress; when recovery has rotated keys or the user activated
   * with different passkeys on different chains, this can differ.
   * Falls back to walletAddress when no destination wallet row exists.
   */
  destWalletAddress: Address;

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

/**
 * Quote for the destination-side Uniswap V3 swap that CrossChainExecutor runs
 * after Across V3 delivers the canonical bridged token. Only present when the
 * user picks an outputToken that differs from the route's canonical pair.
 */
export type BridgeDestSwap = {
  /** Canonical destination-chain token the SpokePool will deliver to the executor. */
  canonicalToken: TokenMetadata;
  /** Estimated outputToken amount the executor will produce, before slippage. */
  expectedOutRaw: bigint;
  /** Minimum outputToken amount enforced by the executor (BridgeMessage.minOut). */
  minOutRaw: bigint;
  /** Uniswap V3 pool fee tier passed to the dest-side exactInputSingle. */
  feeTier: number;
  /** Pool address — informational, surfaced in metadata. */
  poolAddress: Address;
  /** Slippage tolerance applied to expectedOutRaw to compute minOutRaw. */
  slippageBps: number;
  /** Unix-seconds deadline carried in BridgeMessage.deadline. */
  deadlineSec: number;
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
  /**
   * What the SpokePool delivers to the destination recipient (after relayer + LP fee).
   * For same-asset bridges this is what the user receives.
   * For cross-chain swaps this is the canonical-token amount handed to the executor
   * BEFORE the dest-side swap — the user's final outputToken amount is `destSwap.expectedOutRaw`.
   */
  outputAmountRaw: bigint;
  /** Total bridge fee in basis points, applied to inputAmountRaw. */
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

  /**
   * Destination-side swap quote — only set when destSwapRequired is true.
   * Carries the (minOut, feeTier, deadline) packed into the Across BridgeMessage.
   */
  destSwap?: BridgeDestSwap;

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
