import { supabase } from "./supabase.js";

export interface UserOpConfirmationInput {
  userOpHash: string;
  success: boolean;
  txHash: string;
  blockNumber: bigint;
  blockTimestampSec: bigint;
}

export async function projectUserOpConfirmation(u: UserOpConfirmationInput): Promise<void> {
  // Backstop only — do NOT fabricate rows that the mobile app did not create.
  const { data: existing } = await supabase
    .from("wallet_transactions")
    .select("id, status")
    .eq("user_op_hash", u.userOpHash)
    .maybeSingle();

  if (!existing) return; // no mobile-authored row — nothing to update

  if (existing.status === "confirmed" || existing.status === "failed") return; // already terminal

  const newStatus = u.success ? "confirmed" : "failed";

  const { error } = await supabase
    .from("wallet_transactions")
    .update({
      status: newStatus,
      transaction_hash: u.txHash,
      block_number: Number(u.blockNumber),
      confirmed_at:
        newStatus === "confirmed"
          ? new Date(Number(u.blockTimestampSec) * 1000).toISOString()
          : null,
      debug_context: { indexer_backstop: true },
    })
    .eq("id", existing.id);

  if (error) {
    console.error("[indexer] projectUserOpConfirmation failed", {
      userOpHash: u.userOpHash,
      txHash: u.txHash,
      error,
    });
  }
}
