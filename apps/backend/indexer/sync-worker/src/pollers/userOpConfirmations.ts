import { ponderDb, supabase, PONDER_SCHEMA } from "../config.js";
import { markSynced } from "../lib/idempotency.js";
import { logger } from "../lib/logger.js";

interface UserOpRow {
  chain_id: string;
  tx_hash: string;
  log_index: number;
  user_op_hash: string;
  sender: string;
  success: boolean;
  actual_gas_cost: string;
  actual_gas_used: string;
  block_number: string;
  block_timestamp: string;
}

const TERMINAL_STATUSES = ["confirmed", "failed"];

export async function pollUserOpConfirmations(): Promise<void> {
  const { rows } = await ponderDb.query<UserOpRow>(
    `SELECT chain_id, tx_hash, log_index, user_op_hash, sender, success,
            actual_gas_cost, actual_gas_used, block_number, block_timestamp
     FROM "${PONDER_SCHEMA}"."user_op_event"
     WHERE synced_to_supabase = false
     LIMIT 200`
  );

  for (const row of rows) {
    // Find the mobile-authored wallet_transaction row by user_op_hash
    const { data: existing } = await supabase
      .from("wallet_transactions")
      .select("id, status")
      .eq("user_op_hash", row.user_op_hash)
      .maybeSingle();

    if (!existing) {
      // No mobile row for this UserOp — mark synced and skip (v1: don't fabricate rows)
      logSkipped(row.user_op_hash);
      await markSynced(ponderDb, "user_op_event", { chain_id: row.chain_id, tx_hash: row.tx_hash, log_index: row.log_index });
      continue;
    }

    if (TERMINAL_STATUSES.includes(existing.status)) {
      // Mobile already confirmed/failed — don't overwrite
      await markSynced(ponderDb, "user_op_event", { chain_id: row.chain_id, tx_hash: row.tx_hash, log_index: row.log_index });
      continue;
    }

    const newStatus = row.success ? "confirmed" : "failed";
    const { error } = await supabase
      .from("wallet_transactions")
      .update({
        status: newStatus,
        transaction_hash: row.tx_hash,
        block_number: Number(row.block_number),
        confirmed_at: newStatus === "confirmed"
          ? new Date(Number(row.block_timestamp) * 1000).toISOString()
          : null,
        debug_context: { indexer_backstop: true },
      })
      .eq("id", existing.id);

    if (error) {
      logger.error({ error, user_op_hash: row.user_op_hash }, "failed to backstop wallet_transaction");
      continue;
    }

    await markSynced(ponderDb, "user_op_event", { chain_id: row.chain_id, tx_hash: row.tx_hash, log_index: row.log_index });
    logger.info({ user_op_hash: row.user_op_hash, status: newStatus }, "backstopped wallet_transaction");
  }
}

function logSkipped(userOpHash: string): void {
  logger.debug({ user_op_hash: userOpHash }, "no mobile row for UserOp, skipping backstop");
}
