import { ponderDb, supabase, PONDER_SCHEMA, CHAIN_ID_TO_NETWORK_KEY } from "../config.js";
import { markSynced, isUniqueViolation, logSkipped } from "../lib/idempotency.js";
import { logger } from "../lib/logger.js";

interface Erc20Row {
  chain_id: string;
  tx_hash: string;
  log_index: number;
  from_address: string;
  to_address: string;
  token_address: string;
  value: string;
  block_number: string;
  block_timestamp: string;
}

export async function pollIncomingErc20(): Promise<void> {
  const { rows } = await ponderDb.query<Erc20Row>(
    `SELECT chain_id, tx_hash, log_index, from_address, to_address,
            token_address, value, block_number, block_timestamp
     FROM "${PONDER_SCHEMA}"."incoming_erc20_transfer"
     WHERE synced_to_supabase = false
     LIMIT 200`
  );

  for (const row of rows) {
    const chainId = Number(row.chain_id);
    const networkKey = CHAIN_ID_TO_NETWORK_KEY[chainId];
    if (!networkKey) {
      logger.warn({ chainId }, "no network_key mapping for chain_id, skipping");
      await markSynced(ponderDb, "incoming_erc20_transfer", { chain_id: row.chain_id, tx_hash: row.tx_hash, log_index: row.log_index });
      continue;
    }

    // Find the aa_wallet row by predicted_address + network_key
    const { data: wallet } = await supabase
      .from("aa_wallets")
      .select("id, user_id, predicted_address")
      .eq("network_key", networkKey)
      .ilike("predicted_address", row.to_address)
      .maybeSingle();

    if (!wallet) {
      logSkipped("incoming_erc20_transfer", "no matching aa_wallet", row.tx_hash);
      await markSynced(ponderDb, "incoming_erc20_transfer", { chain_id: row.chain_id, tx_hash: row.tx_hash, log_index: row.log_index });
      continue;
    }

    const valueRaw = row.value;
    const decimals = 18; // default; token metadata enhancement is a future task
    const amountDisplay = (BigInt(valueRaw) / BigInt(10 ** decimals)).toString();

    try {
      const { error } = await supabase.from("wallet_transactions").insert({
        user_id: wallet.user_id,
        aa_wallet_id: wallet.id,
        wallet_address: wallet.predicted_address,
        chain_id: chainId,
        type: "send_erc20",
        status: "confirmed",
        direction: "incoming",
        token_type: "erc20",
        token_address: row.token_address,
        token_symbol: "ERC20",
        token_decimals: decimals,
        from_address: row.from_address,
        to_address: row.to_address,
        amount_raw: valueRaw,
        amount_display: amountDisplay,
        target_address: row.to_address,
        value_raw: "0",
        calldata: "0x",
        transaction_hash: row.tx_hash,
        block_number: Number(row.block_number),
        confirmed_at: new Date(Number(row.block_timestamp) * 1000).toISOString(),
        network_key: networkKey,
      });

      if (error && error.code !== "23505") {
        logger.error({ error, tx_hash: row.tx_hash }, "failed to insert wallet_transaction");
        continue;
      }
    } catch (err) {
      if (!isUniqueViolation(err)) {
        logger.error({ err, tx_hash: row.tx_hash }, "unexpected error inserting wallet_transaction");
        continue;
      }
    }

    await markSynced(ponderDb, "incoming_erc20_transfer", { chain_id: row.chain_id, tx_hash: row.tx_hash, log_index: row.log_index });
    logger.info({ tx_hash: row.tx_hash, to: row.to_address }, "synced incoming ERC-20 transfer");
  }
}
