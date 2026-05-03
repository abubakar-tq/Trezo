import { getSupabaseClient } from "@/src/lib/supabase";
import { getBundlerUrl } from "@/src/core/network/chain";
import { getDeployment } from "@/src/integration/viem/deployments";
import type { PreparedSend, TransactionRecord, TransactionStatus, SendIntent } from "@/src/features/send/types/send";
import type { SignedUserOperation } from "@/src/features/wallet/types/execution";
import type { UserOperationReceiptResult } from "@/src/features/wallet/services/SmartAccountExecutionService";
import { formatUnits, type Hex } from "viem";

type WalletTransactionRow = {
  id: string;
  user_id: string;
  aa_wallet_id: string | null;
  wallet_address: string;
  chain_id: number;
  type: TransactionRecord["type"];
  status: TransactionStatus;
  direction: "incoming" | "outgoing" | "self";
  token_type: "native" | "erc20";
  token_address: string | null;
  token_symbol: string;
  token_decimals: number;
  from_address: string;
  to_address: string;
  amount_raw: string;
  amount_display: string;
  target_address: string;
  value_raw: string;
  calldata: Hex;
  user_op_hash: string | null;
  transaction_hash: string | null;
  block_number: string | number | null;
  entry_point: string | null;
  bundler_url: string | null;
  paymaster_used: boolean | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  confirmed_at: string | null;
};

const supabase = getSupabaseClient();

const toRecord = (row: WalletTransactionRow): TransactionRecord => ({
  id: row.id,
  userId: row.user_id,
  aaWalletId: row.aa_wallet_id,
  walletAddress: row.wallet_address as TransactionRecord["walletAddress"],
  chainId: row.chain_id,
  type: row.type,
  status: row.status,
  tokenType: row.token_type,
  tokenAddress: row.token_address as TransactionRecord["tokenAddress"],
  tokenSymbol: row.token_symbol,
  tokenDecimals: row.token_decimals,
  fromAddress: row.from_address as TransactionRecord["fromAddress"],
  toAddress: row.to_address as TransactionRecord["toAddress"],
  amountRaw: row.amount_raw,
  amountDisplay: row.amount_display,
  targetAddress: row.target_address as TransactionRecord["targetAddress"],
  valueRaw: row.value_raw,
  calldata: row.calldata,
  userOpHash: row.user_op_hash as TransactionRecord["userOpHash"],
  transactionHash: row.transaction_hash as TransactionRecord["transactionHash"],
  blockNumber: row.block_number !== null && row.block_number !== undefined ? BigInt(row.block_number) : null,
  entryPoint: row.entry_point as TransactionRecord["entryPoint"],
  bundlerUrl: row.bundler_url,
  paymasterUsed: row.paymaster_used ?? false,
  errorCode: row.error_code,
  errorMessage: row.error_message,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  submittedAt: row.submitted_at,
  confirmedAt: row.confirmed_at,
});

const loadById = async (id: string): Promise<TransactionRecord | null> => {
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

const nowIso = () => new Date().toISOString();

export class TransactionHistoryService {
  static async getById(id: string): Promise<TransactionRecord | null> {
    return loadById(id);
  }

  static async createDraft(intent: SendIntent): Promise<TransactionRecord> {
    const deployment = getDeployment(intent.chainId);
    let bundlerUrl: string | null = null;

    try {
      bundlerUrl = getBundlerUrl(intent.chainId);
    } catch {
      bundlerUrl = null;
    }

    const { data, error } = await supabase
      .from("wallet_transactions")
      .insert({
        user_id: intent.userId,
        aa_wallet_id: intent.aaWalletId,
        wallet_address: intent.walletAddress.toLowerCase(),
        chain_id: intent.chainId,
        type: intent.token.type === "native" ? "send_native" : "send_erc20",
        status: "draft",
        direction: "outgoing",
        token_type: intent.token.type,
        token_address: intent.token.type === "erc20" ? intent.token.address.toLowerCase() : null,
        token_symbol: intent.token.symbol,
        token_decimals: intent.token.decimals,
        from_address: intent.walletAddress.toLowerCase(),
        to_address: intent.recipient.toLowerCase(),
        amount_raw: "0",
        amount_display: intent.amountDecimal,
        target_address: intent.recipient.toLowerCase(),
        value_raw: "0",
        calldata: "0x",
        entry_point: deployment?.entryPoint ?? null,
        bundler_url: bundlerUrl,
        paymaster_used: false,
        debug_context: intent.memo ? { memo: intent.memo } : null,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create draft transaction: ${error.message}`);
    }

    return toRecord(data as WalletTransactionRow);
  }

  static async markPrepared(id: string, prepared: PreparedSend): Promise<TransactionRecord> {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .update({
        status: "prepared",
        type: prepared.intent.token.type === "native" ? "send_native" : "send_erc20",
        token_type: prepared.intent.token.type,
        token_address: prepared.intent.token.type === "erc20"
          ? prepared.intent.token.address.toLowerCase()
          : null,
        token_symbol: prepared.intent.token.symbol,
        token_decimals: prepared.intent.token.decimals,
        to_address: prepared.validation.recipient.toLowerCase(),
        amount_raw: prepared.validation.amountRaw.toString(),
        amount_display: formatUnits(prepared.validation.amountRaw, prepared.intent.token.decimals),
        target_address: prepared.targetAddress.toLowerCase(),
        value_raw: prepared.valueRaw.toString(),
        calldata: prepared.calldata,
        paymaster_used: prepared.validation.feeMode === "sponsored",
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to mark transaction prepared: ${error.message}`);
    }

    return toRecord(data as WalletTransactionRow);
  }

  static async markSigning(id: string): Promise<TransactionRecord> {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .update({ status: "signing" })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to mark transaction signing: ${error.message}`);
    }

    return toRecord(data as WalletTransactionRow);
  }

  static async markSigned(id: string, signed: SignedUserOperation): Promise<TransactionRecord> {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .update({
        status: "signed",
        debug_context: {
          signatureBytes: signed.signature.length > 2 ? (signed.signature.length - 2) / 2 : 0,
          userOpHash: signed.userOpHash,
        },
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to mark transaction signed: ${error.message}`);
    }

    return toRecord(data as WalletTransactionRow);
  }

  static async markSubmitted(id: string, userOpHash: Hex): Promise<TransactionRecord> {
    const current = await loadById(id);
    if (!current) {
      throw new Error(`Transaction ${id} not found`);
    }

    if (current.status === "confirmed") {
      return current;
    }

    if (current.userOpHash && current.userOpHash.toLowerCase() !== userOpHash.toLowerCase()) {
      throw new Error(`Transaction ${id} already has a different userOpHash`);
    }

    const { data, error } = await supabase
      .from("wallet_transactions")
      .update({
        status: "submitted",
        user_op_hash: userOpHash,
        submitted_at: current.submittedAt ?? nowIso(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to mark transaction submitted: ${error.message}`);
    }

    return toRecord(data as WalletTransactionRow);
  }

  static async markPending(id: string): Promise<TransactionRecord> {
    const current = await loadById(id);
    if (!current) {
      throw new Error(`Transaction ${id} not found`);
    }

    if (current.status === "confirmed") {
      return current;
    }

    const { data, error } = await supabase
      .from("wallet_transactions")
      .update({ status: "pending" })
      .eq("id", id)
      .neq("status", "confirmed")
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to mark transaction pending: ${error.message}`);
    }

    return toRecord(data as WalletTransactionRow);
  }

  static async markConfirmed(id: string, receipt: UserOperationReceiptResult): Promise<TransactionRecord> {
    const current = await loadById(id);
    if (!current) {
      throw new Error(`Transaction ${id} not found`);
    }

    if (current.status === "confirmed") {
      if (
        current.transactionHash
        && receipt.transactionHash
        && current.transactionHash.toLowerCase() !== receipt.transactionHash.toLowerCase()
      ) {
        throw new Error(`Transaction ${id} is already confirmed with a different transaction hash`);
      }
      return current;
    }

    const { data, error } = await supabase
      .from("wallet_transactions")
      .update({
        status: receipt.success ? "confirmed" : "failed",
        transaction_hash: receipt.transactionHash ?? null,
        block_number: receipt.blockNumber?.toString() ?? null,
        confirmed_at: receipt.success ? nowIso() : null,
        error_message: receipt.success ? null : "UserOperation receipt reported failure",
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to mark transaction confirmed: ${error.message}`);
    }

    return toRecord(data as WalletTransactionRow);
  }

  static async markFailed(id: string, errorValue: unknown): Promise<TransactionRecord> {
    const current = await loadById(id);
    if (!current) {
      throw new Error(`Transaction ${id} not found`);
    }

    if (current.status === "confirmed") {
      return current;
    }

    const errorCode = typeof errorValue === "object" && errorValue !== null && "code" in errorValue
      ? String((errorValue as { code?: unknown }).code)
      : null;

    const errorMessage = errorValue instanceof Error
      ? errorValue.message
      : typeof errorValue === "string"
        ? errorValue
        : "Unknown send execution failure";

    const { data, error } = await supabase
      .from("wallet_transactions")
      .update({
        status: "failed",
        error_code: errorCode,
        error_message: errorMessage,
        debug_context: {
          at: nowIso(),
          source: "SendExecutionService",
        },
      })
      .eq("id", id)
      .neq("status", "confirmed")
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to mark transaction failed: ${error.message}`);
    }

    return toRecord(data as WalletTransactionRow);
  }

  static async markCancelled(id: string): Promise<TransactionRecord> {
    const current = await loadById(id);
    if (!current) {
      throw new Error(`Transaction ${id} not found`);
    }

    if (current.status === "confirmed") {
      return current;
    }

    const { data, error } = await supabase
      .from("wallet_transactions")
      .update({ status: "cancelled" })
      .eq("id", id)
      .neq("status", "confirmed")
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to mark transaction cancelled: ${error.message}`);
    }

    return toRecord(data as WalletTransactionRow);
  }

  static async listForWallet(
    userId: string,
    walletAddress: string,
    chainId?: number,
  ): Promise<TransactionRecord[]> {
    let query = supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("wallet_address", walletAddress.toLowerCase())
      .order("created_at", { ascending: false });

    if (chainId !== undefined) {
      query = query.eq("chain_id", chainId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list wallet transactions: ${error.message}`);
    }

    return (data as WalletTransactionRow[]).map(toRecord);
  }

  static async getByUserOpHash(userOpHash: Hex): Promise<TransactionRecord | null> {
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

  static async listTrackablePending(
    userId: string,
    walletAddress: string,
    chainId?: number,
  ): Promise<TransactionRecord[]> {
    let query = supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("wallet_address", walletAddress.toLowerCase())
      .in("status", ["submitted", "pending"])
      .not("user_op_hash", "is", null)
      .order("created_at", { ascending: true });

    if (chainId !== undefined) {
      query = query.eq("chain_id", chainId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list pending transactions: ${error.message}`);
    }

    return (data as WalletTransactionRow[]).map(toRecord);
  }
}

export default TransactionHistoryService;
