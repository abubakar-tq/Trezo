import { getBundlerUrl } from "@/src/core/network/chain";
import type { NetworkKey } from "@/src/integration/networks";
import type {
  CreateWalletTransactionInput,
  WalletTransaction,
  WalletTransactionDirection,
  WalletTransactionFeeMode,
  WalletTransactionStatus,
  WalletTransactionTokenType,
  WalletTransactionTransitionPatch,
  WalletTransactionType,
} from "@/src/features/transactions/types/transaction";
import type { SupportedChainId } from "@/src/integration/chains";
import { getDeployment } from "@/src/integration/viem/deployments";
import { getSupabaseClient } from "@/src/lib/supabase";
import type { Address, Hex } from "viem";

type WalletTransactionRow = {
  id: string;
  user_id: string;
  aa_wallet_id: string | null;
  wallet_address: string;
  chain_id: number;
  type: WalletTransactionType;
  status: WalletTransactionStatus;
  direction: WalletTransactionDirection;
  token_type: WalletTransactionTokenType | null;
  token_address: string | null;
  token_symbol: string | null;
  token_decimals: number | null;
  from_address: string | null;
  to_address: string | null;
  amount_raw: string | null;
  amount_display: string | null;
  target_address: string | null;
  value_raw: string | null;
  calldata: Hex | null;
  user_op_hash: string | null;
  transaction_hash: string | null;
  block_number: string | number | null;
  entry_point: string | null;
  bundler_url: string | null;
  paymaster_used: boolean | null;
  fee_mode: WalletTransactionFeeMode | null;
  intent_id: string | null;
  parent_transaction_id: string | null;
  sequence_index: number | null;
  metadata: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  debug_context: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  prepared_at: string | null;
  signing_started_at: string | null;
  signed_at: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  failed_at: string | null;
  network_key: string | null;
};

type JsonObject = Record<string, unknown>;

const supabase = getSupabaseClient();

const ALLOWED_TRANSITIONS: Record<WalletTransactionStatus, WalletTransactionStatus[]> = {
  draft: ["prepared", "cancelled", "failed"],
  prepared: ["signing", "cancelled", "failed"],
  signing: ["signed", "cancelled", "failed"],
  signed: ["submitted", "failed"],
  submitted: ["pending", "failed", "dropped"],
  pending: ["confirmed", "failed", "dropped"],
  confirmed: [],
  failed: [],
  cancelled: [],
  dropped: [],
};

const nowIso = () => new Date().toISOString();

const asLower = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return value.toLowerCase();
};

const mergeObjects = (
  current: JsonObject | null | undefined,
  next: JsonObject | null | undefined,
): JsonObject | null => {
  if (!current && !next) return null;
  return {
    ...(current ?? {}),
    ...(next ?? {}),
  };
};

const toRecord = (row: WalletTransactionRow): WalletTransaction => ({
  id: row.id,
  userId: row.user_id,
  aaWalletId: row.aa_wallet_id,
  walletAddress: row.wallet_address as Address,
  chainId: row.chain_id,
  type: row.type,
  status: row.status,
  direction: row.direction,
  tokenType: row.token_type,
  tokenAddress: row.token_address as Address | null,
  tokenSymbol: row.token_symbol,
  tokenDecimals: row.token_decimals,
  fromAddress: row.from_address as Address | null,
  toAddress: row.to_address as Address | null,
  amountRaw: row.amount_raw,
  amountDisplay: row.amount_display,
  targetAddress: row.target_address as Address | null,
  valueRaw: row.value_raw,
  calldata: row.calldata,
  userOpHash: row.user_op_hash as Hex | null,
  transactionHash: row.transaction_hash as Hex | null,
  blockNumber: row.block_number !== null && row.block_number !== undefined ? BigInt(row.block_number) : null,
  entryPoint: row.entry_point as Address | null,
  bundlerUrl: row.bundler_url,
  paymasterUsed: row.paymaster_used ?? false,
  feeMode: row.fee_mode,
  intentId: row.intent_id,
  parentTransactionId: row.parent_transaction_id,
  sequenceIndex: row.sequence_index,
  metadata: row.metadata ?? {},
  errorCode: row.error_code,
  errorMessage: row.error_message,
  debugContext: row.debug_context,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  preparedAt: row.prepared_at,
  signingStartedAt: row.signing_started_at,
  signedAt: row.signed_at,
  submittedAt: row.submitted_at,
  confirmedAt: row.confirmed_at,
  failedAt: row.failed_at,
  networkKey: (row.network_key ?? "anvil-local") as NetworkKey,
});

const loadById = async (id: string): Promise<WalletTransaction | null> => {
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load transaction ${id}: ${error.message}`);
  }

  return data ? toRecord(data as WalletTransactionRow) : null;
};

const assertTransition = (
  currentStatus: WalletTransactionStatus,
  nextStatus: WalletTransactionStatus,
  context: string,
): void => {
  if (currentStatus === nextStatus) return;

  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`Invalid transaction transition in ${context}: ${currentStatus} -> ${nextStatus}`);
  }
};

const buildPatchUpdate = (patch: WalletTransactionTransitionPatch): Record<string, unknown> => {
  const update: Record<string, unknown> = {};

  if (patch.type !== undefined) update.type = patch.type;
  if (patch.direction !== undefined) update.direction = patch.direction;
  if (patch.tokenType !== undefined) update.token_type = patch.tokenType;
  if (patch.tokenAddress !== undefined) update.token_address = asLower(patch.tokenAddress);
  if (patch.tokenSymbol !== undefined) update.token_symbol = patch.tokenSymbol;
  if (patch.tokenDecimals !== undefined) update.token_decimals = patch.tokenDecimals;
  if (patch.fromAddress !== undefined) update.from_address = asLower(patch.fromAddress);
  if (patch.toAddress !== undefined) update.to_address = asLower(patch.toAddress);
  if (patch.amountRaw !== undefined) update.amount_raw = patch.amountRaw;
  if (patch.amountDisplay !== undefined) update.amount_display = patch.amountDisplay;
  if (patch.targetAddress !== undefined) update.target_address = asLower(patch.targetAddress);
  if (patch.valueRaw !== undefined) update.value_raw = patch.valueRaw;
  if (patch.calldata !== undefined) update.calldata = patch.calldata;
  if (patch.userOpHash !== undefined) update.user_op_hash = patch.userOpHash;
  if (patch.transactionHash !== undefined) update.transaction_hash = patch.transactionHash;
  if (patch.blockNumber !== undefined) update.block_number = patch.blockNumber?.toString() ?? null;
  if (patch.entryPoint !== undefined) update.entry_point = asLower(patch.entryPoint);
  if (patch.bundlerUrl !== undefined) update.bundler_url = patch.bundlerUrl;
  if (patch.paymasterUsed !== undefined) update.paymaster_used = patch.paymasterUsed;
  if (patch.feeMode !== undefined) update.fee_mode = patch.feeMode;
  if (patch.intentId !== undefined) update.intent_id = patch.intentId;
  if (patch.parentTransactionId !== undefined) update.parent_transaction_id = patch.parentTransactionId;
  if (patch.sequenceIndex !== undefined) update.sequence_index = patch.sequenceIndex;
  if (patch.metadata !== undefined) update.metadata = patch.metadata;
  if (patch.errorCode !== undefined) update.error_code = patch.errorCode;
  if (patch.errorMessage !== undefined) update.error_message = patch.errorMessage;
  if (patch.debugContext !== undefined) update.debug_context = patch.debugContext;

  return update;
};

const updateById = async (id: string, patch: Record<string, unknown>): Promise<WalletTransaction> => {
  const { data, error } = await supabase
    .from("wallet_transactions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update transaction ${id}: ${error.message}`);
  }

  return toRecord(data as WalletTransactionRow);
};

export class TransactionHistoryService {
  static async getById(id: string): Promise<WalletTransaction | null> {
    return loadById(id);
  }

  static async getByUserOpHash(userOpHash: Hex): Promise<WalletTransaction | null> {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_op_hash", userOpHash)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load transaction by userOpHash: ${error.message}`);
    }

    return data ? toRecord(data as WalletTransactionRow) : null;
  }

  static async createDraft(input: CreateWalletTransactionInput): Promise<WalletTransaction> {
    let bundlerUrl = input.bundlerUrl ?? null;
    if (!bundlerUrl) {
      try {
        bundlerUrl = getBundlerUrl(input.chainId as SupportedChainId);
      } catch {
        bundlerUrl = null;
      }
    }

    let deploymentEntryPoint: string | null = null;
    try {
      deploymentEntryPoint = getDeployment(input.chainId as SupportedChainId)?.entryPoint ?? null;
    } catch {
      deploymentEntryPoint = null;
    }
    const metadata = input.metadata ?? {};

    const { data, error } = await supabase
      .from("wallet_transactions")
      .insert({
        user_id: input.userId,
        aa_wallet_id: input.aaWalletId ?? null,
        wallet_address: input.walletAddress.toLowerCase(),
        chain_id: input.chainId,
        type: input.type,
        status: "draft",
        direction: input.direction ?? "outgoing",
        token_type: input.tokenType ?? null,
        token_address: asLower(input.tokenAddress),
        token_symbol: input.tokenSymbol ?? null,
        token_decimals: input.tokenDecimals ?? null,
        from_address: asLower(input.fromAddress),
        to_address: asLower(input.toAddress),
        amount_raw: input.amountRaw ?? null,
        amount_display: input.amountDisplay ?? null,
        target_address: asLower(input.targetAddress),
        value_raw: input.valueRaw ?? "0",
        calldata: input.calldata ?? "0x",
        entry_point: asLower(input.entryPoint) ?? deploymentEntryPoint,
        bundler_url: bundlerUrl,
        paymaster_used: input.paymasterUsed ?? false,
        fee_mode: input.feeMode ?? null,
        intent_id: input.intentId ?? null,
        parent_transaction_id: input.parentTransactionId ?? null,
        sequence_index: input.sequenceIndex ?? null,
        metadata,
        debug_context: input.debugContext ?? null,
        network_key: input.networkKey ?? "anvil-local",
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create draft transaction: ${error.message}`);
    }

    return toRecord(data as WalletTransactionRow);
  }

  static async markPrepared(
    id: string,
    patch?: WalletTransactionTransitionPatch,
  ): Promise<WalletTransaction> {
    const current = await loadById(id);
    if (!current) {
      throw new Error(`Transaction ${id} not found`);
    }

    assertTransition(current.status, "prepared", "markPrepared");

    const update = buildPatchUpdate(patch ?? {});
    update.status = "prepared";
    update.prepared_at = current.preparedAt ?? nowIso();

    if (patch?.metadata) {
      update.metadata = {
        ...current.metadata,
        ...patch.metadata,
      };
    }

    if (patch?.debugContext) {
      update.debug_context = mergeObjects(current.debugContext, patch.debugContext);
    }

    return updateById(id, update);
  }

  static async markSigning(id: string): Promise<WalletTransaction> {
    const current = await loadById(id);
    if (!current) {
      throw new Error(`Transaction ${id} not found`);
    }

    assertTransition(current.status, "signing", "markSigning");

    return updateById(id, {
      status: "signing",
      signing_started_at: current.signingStartedAt ?? nowIso(),
    });
  }

  static async markSigned(
    id: string,
    debugContext?: JsonObject,
  ): Promise<WalletTransaction> {
    const current = await loadById(id);
    if (!current) {
      throw new Error(`Transaction ${id} not found`);
    }

    assertTransition(current.status, "signed", "markSigned");

    return updateById(id, {
      status: "signed",
      signed_at: current.signedAt ?? nowIso(),
      debug_context: mergeObjects(current.debugContext, debugContext),
    });
  }

  static async markSubmitted(params: {
    id: string;
    userOpHash: Hex;
    debugContext?: JsonObject;
  }): Promise<WalletTransaction> {
    const current = await loadById(params.id);
    if (!current) {
      throw new Error(`Transaction ${params.id} not found`);
    }

    const nextHash = params.userOpHash.toLowerCase() as Hex;
    if (current.userOpHash && current.userOpHash.toLowerCase() !== nextHash) {
      throw new Error(`Transaction ${params.id} already has a different userOpHash`);
    }

    if (current.status === "submitted") {
      return current;
    }

    assertTransition(current.status, "submitted", "markSubmitted");

    return updateById(params.id, {
      status: "submitted",
      user_op_hash: nextHash,
      submitted_at: current.submittedAt ?? nowIso(),
      debug_context: mergeObjects(current.debugContext, params.debugContext),
    });
  }

  static async markPending(id: string): Promise<WalletTransaction> {
    const current = await loadById(id);
    if (!current) {
      throw new Error(`Transaction ${id} not found`);
    }

    if (current.status === "pending") {
      return current;
    }

    if (!current.userOpHash) {
      throw new Error(`Cannot mark transaction ${id} as pending without userOpHash`);
    }

    assertTransition(current.status, "pending", "markPending");

    return updateById(id, {
      status: "pending",
    });
  }

  static async markConfirmed(params: {
    id: string;
    transactionHash?: Hex | null;
    blockNumber?: bigint | null;
    debugContext?: JsonObject;
  }): Promise<WalletTransaction> {
    const current = await loadById(params.id);
    if (!current) {
      throw new Error(`Transaction ${params.id} not found`);
    }

    const normalizedTxHash = params.transactionHash?.toLowerCase() as Hex | undefined;
    const effectiveTxHash = normalizedTxHash ?? current.transactionHash ?? undefined;

    if (!effectiveTxHash) {
      throw new Error(`Cannot mark transaction ${params.id} confirmed without transaction hash`);
    }

    if (current.status === "confirmed") {
      if (current.transactionHash && current.transactionHash.toLowerCase() !== effectiveTxHash.toLowerCase()) {
        throw new Error(`Transaction ${params.id} is already confirmed with a different transaction hash`);
      }
      return current;
    }

    if (current.status !== "pending") {
      throw new Error(`Invalid transaction transition in markConfirmed: ${current.status} -> confirmed`);
    }

    return updateById(params.id, {
      status: "confirmed",
      transaction_hash: effectiveTxHash,
      block_number: params.blockNumber?.toString() ?? current.blockNumber?.toString() ?? null,
      confirmed_at: current.confirmedAt ?? nowIso(),
      error_code: null,
      error_message: null,
      debug_context: mergeObjects(current.debugContext, params.debugContext),
    });
  }

  static async markFailed(params: {
    id: string;
    errorMessage: string;
    errorCode?: string | null;
    debugContext?: JsonObject;
  }): Promise<WalletTransaction> {
    const current = await loadById(params.id);
    if (!current) {
      throw new Error(`Transaction ${params.id} not found`);
    }

    if (current.status === "failed") {
      return current;
    }

    assertTransition(current.status, "failed", "markFailed");

    const now = nowIso();
    const debugContext = mergeObjects(current.debugContext, {
      lastError: {
        code: params.errorCode ?? null,
        message: params.errorMessage,
        at: now,
      },
      ...(params.debugContext ?? {}),
    });

    return updateById(params.id, {
      status: "failed",
      error_code: params.errorCode ?? null,
      error_message: params.errorMessage,
      failed_at: current.failedAt ?? now,
      debug_context: debugContext,
    });
  }

  static async markCancelled(id: string, reason?: string): Promise<WalletTransaction> {
    const current = await loadById(id);
    if (!current) {
      throw new Error(`Transaction ${id} not found`);
    }

    if (current.status === "cancelled") {
      return current;
    }

    assertTransition(current.status, "cancelled", "markCancelled");

    return updateById(id, {
      status: "cancelled",
      debug_context: mergeObjects(current.debugContext, reason ? { cancelReason: reason } : null),
    });
  }

  static async markDropped(id: string, reason?: string): Promise<WalletTransaction> {
    const current = await loadById(id);
    if (!current) {
      throw new Error(`Transaction ${id} not found`);
    }

    if (current.status === "dropped") {
      return current;
    }

    assertTransition(current.status, "dropped", "markDropped");

    return updateById(id, {
      status: "dropped",
      debug_context: mergeObjects(current.debugContext, reason ? { dropReason: reason } : null),
    });
  }

  static async appendDebugContext(id: string, patch: JsonObject): Promise<WalletTransaction> {
    const current = await loadById(id);
    if (!current) {
      throw new Error(`Transaction ${id} not found`);
    }

    return updateById(id, {
      debug_context: mergeObjects(current.debugContext, patch),
    });
  }

  static async listForWallet(params: {
    userId?: string;
    walletAddress: Address;
    chainId?: number;
    networkKey?: NetworkKey;
    limit?: number;
  }): Promise<WalletTransaction[]> {
    let query = supabase
      .from("wallet_transactions")
      .select("*")
      .eq("wallet_address", params.walletAddress.toLowerCase())
      .order("created_at", { ascending: false });

    if (params.userId) {
      query = query.eq("user_id", params.userId);
    }

    if (params.chainId !== undefined) {
      query = query.eq("chain_id", params.chainId);
    }

    if (params.networkKey !== undefined) {
      query = query.eq("network_key", params.networkKey);
    }

    if (params.limit !== undefined) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list wallet transactions: ${error.message}`);
    }

    return (data as WalletTransactionRow[]).map(toRecord);
  }

  static async listPendingForWallet(params: {
    userId?: string;
    walletAddress: Address;
    chainId?: number;
  }): Promise<WalletTransaction[]> {
    let query = supabase
      .from("wallet_transactions")
      .select("*")
      .eq("wallet_address", params.walletAddress.toLowerCase())
      .in("status", ["submitted", "pending"])
      .not("user_op_hash", "is", null)
      .order("created_at", { ascending: true });

    if (params.userId) {
      query = query.eq("user_id", params.userId);
    }

    if (params.chainId !== undefined) {
      query = query.eq("chain_id", params.chainId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list pending transactions: ${error.message}`);
    }

    return (data as WalletTransactionRow[]).map(toRecord);
  }
}

export default TransactionHistoryService;
