/**
 * activity.ts — Extension data layer: transaction activity feed
 *
 * Queries Supabase `wallet_transactions` exactly like
 * TransactionHistoryService.listForWallet on mobile.
 * Maps rows to a compact ActivityItem type.
 * Runs in both popup and service worker.
 */

import { supabase } from "../auth/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  type: string;
  status: string;
  direction: string;
  tokenSymbol: string | null;
  amountDisplay: string | null;
  transactionHash: string | null;
  userOpHash: string | null;
  paymasterUsed: boolean;
  createdAt: string;
  // Extended fields for detail view
  fromAddress: string | null;
  toAddress: string | null;
  blockNumber: number | null;
  fee: string | null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * List recent transactions for `walletAddress` on `chainId`.
 * Mirrors TransactionHistoryService.listForWallet: eq wallet_address (lowercased),
 * eq chain_id, order created_at desc, limit.
 * Never throws — returns [] on auth/network error.
 */
export async function listActivity(
  walletAddress: string,
  chainId: number,
  limit = 25,
): Promise<ActivityItem[]> {
  try {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select(
        "id, type, status, direction, token_symbol, amount_display, transaction_hash, user_op_hash, paymaster_used, created_at, from_address, to_address, block_number, effective_gas_price_wei, gas_used",
      )
      .eq("wallet_address", walletAddress.toLowerCase())
      .eq("chain_id", chainId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("[activity] listActivity query failed:", error.message);
      return [];
    }

    return (data ?? []).map((row) => {
      // Compute fee string from gas_used * effective_gas_price_wei
      let fee: string | null = null;
      if (row.gas_used && row.effective_gas_price_wei) {
        try {
          const gasUsed = BigInt(String(row.gas_used));
          const gasPrice = BigInt(String(row.effective_gas_price_wei));
          const feeWei = gasUsed * gasPrice;
          // Divide BigInt by 10^12 first to stay within safe integer range, then convert
          const feeEth = Number(feeWei / 1_000_000_000_000n) / 1_000_000;
          fee = feeEth < 0.000001 ? "<0.000001 ETH" : `${feeEth.toFixed(6)} ETH`;
        } catch {
          // ignore
        }
      }
      return {
        id: row.id as string,
        type: row.type as string,
        status: row.status as string,
        direction: row.direction as string,
        tokenSymbol: row.token_symbol as string | null,
        amountDisplay: row.amount_display as string | null,
        transactionHash: row.transaction_hash as string | null,
        userOpHash: row.user_op_hash as string | null,
        paymasterUsed: Boolean(row.paymaster_used),
        createdAt: row.created_at as string,
        fromAddress: (row.from_address as string | null) ?? null,
        toAddress: (row.to_address as string | null) ?? null,
        blockNumber: row.block_number != null ? Number(row.block_number) : null,
        fee,
      };
    });
  } catch (err) {
    console.warn("[activity] listActivity unexpected error:", err);
    return [];
  }
}
