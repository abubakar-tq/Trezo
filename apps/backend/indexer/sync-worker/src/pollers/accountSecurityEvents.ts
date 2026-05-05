import { ponderDb, supabase, PONDER_SCHEMA, CHAIN_ID_TO_NETWORK_KEY } from "../config.js";
import { markSynced, isUniqueViolation, logSkipped } from "../lib/idempotency.js";
import { logger } from "../lib/logger.js";

interface SecurityEventRow {
  chain_id: string;
  tx_hash: string;
  log_index: number;
  wallet_address: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  block_number: string;
  block_timestamp: string;
}

export async function pollAccountSecurityEvents(): Promise<void> {
  const { rows } = await ponderDb.query<SecurityEventRow>(
    `SELECT chain_id, tx_hash, log_index, wallet_address, event_type,
            event_data, block_number, block_timestamp
     FROM "${PONDER_SCHEMA}"."account_security_event"
     WHERE synced_to_supabase = false
     LIMIT 200`
  );

  for (const row of rows) {
    const chainId = Number(row.chain_id);
    const networkKey = CHAIN_ID_TO_NETWORK_KEY[chainId];

    // Resolve wallet from aa_wallets — uses wallet_address as the lookup key.
    // For HashedApproval/RejectHash, wallet_address is the guardian; skip notification
    // (user_id will be null unless the guardian IS a known wallet owner).
    const { data: wallet } = await supabase
      .from("aa_wallets")
      .select("id, user_id")
      .eq("network_key", networkKey ?? "anvil-local")
      .ilike("predicted_address", row.wallet_address)
      .maybeSingle();

    try {
      const { error } = await supabase.from("account_security_events").insert({
        user_id: wallet?.user_id ?? null,
        aa_wallet_id: wallet?.id ?? null,
        wallet_address: row.wallet_address,
        chain_id: chainId,
        event_type: row.event_type,
        event_data: row.event_data ?? {},
        tx_hash: row.tx_hash,
        log_index: row.log_index,
        block_number: Number(row.block_number),
        block_timestamp: Number(row.block_timestamp),
      });

      if (error && error.code !== "23505") {
        logger.error({ error, tx_hash: row.tx_hash }, "failed to insert security event");
        continue;
      }
    } catch (err) {
      if (!isUniqueViolation(err)) {
        logger.error({ err, tx_hash: row.tx_hash }, "unexpected error inserting security event");
        continue;
      }
      logSkipped("account_security_event", "duplicate", row.tx_hash);
    }

    await markSynced(ponderDb, "account_security_event", { chain_id: row.chain_id, tx_hash: row.tx_hash, log_index: row.log_index });
    logger.info({ event_type: row.event_type, wallet: row.wallet_address }, "synced security event");
  }
}
