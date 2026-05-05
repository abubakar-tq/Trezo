import { ponderDb, supabase, PONDER_SCHEMA, CHAIN_ID_TO_NETWORK_KEY } from "../config.js";
import { logger } from "../lib/logger.js";

interface SmartAccountRow {
  chain_id: string;
  account_address: string;
}

// Audit-only: logs smart_account rows that have no matching aa_wallets entry.
// Does NOT auto-insert into aa_wallets — the mobile app is the authoritative writer.
export async function auditSmartAccountRegistry(): Promise<void> {
  const { rows } = await ponderDb.query<SmartAccountRow>(
    `SELECT chain_id, account_address
     FROM "${PONDER_SCHEMA}"."smart_account"
     LIMIT 500`
  );

  for (const row of rows) {
    const chainId = Number(row.chain_id);
    const networkKey = CHAIN_ID_TO_NETWORK_KEY[chainId];
    if (!networkKey) continue;

    const { data } = await supabase
      .from("aa_wallets")
      .select("id")
      .eq("network_key", networkKey)
      .ilike("predicted_address", row.account_address)
      .maybeSingle();

    if (!data) {
      logger.warn(
        { account_address: row.account_address, chain_id: chainId },
        "on-chain smart account has no matching aa_wallets row"
      );
    }
  }
}
