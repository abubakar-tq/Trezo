import { supabase } from "./supabase.js";
import { networkKeyForChain } from "./networkKeys.js";

export interface SecurityEventInput {
  chainId: number;
  walletAddress: string;
  eventType: string;
  eventData: Record<string, unknown>;
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  blockTimestampSec: bigint;
}

export async function projectSecurityEvent(e: SecurityEventInput): Promise<void> {
  const networkKey = networkKeyForChain(e.chainId);

  // Look up wallet — nullable: we insert even if the wallet is not yet in Supabase.
  const { data: wallet } = await supabase
    .from("aa_wallets")
    .select("id, user_id")
    .eq("network_key", networkKey ?? "anvil-local")
    .ilike("predicted_address", e.walletAddress)
    .maybeSingle();

  const { error } = await supabase.from("account_security_events").insert({
    user_id: wallet?.user_id ?? null,
    aa_wallet_id: wallet?.id ?? null,
    wallet_address: e.walletAddress,
    chain_id: e.chainId,
    event_type: e.eventType,
    event_data: e.eventData,
    tx_hash: e.txHash,
    log_index: e.logIndex,
    block_number: Number(e.blockNumber),
    block_timestamp: Number(e.blockTimestampSec),
  });

  if (error && error.code !== "23505") {
    console.error("[indexer] projectSecurityEvent failed", {
      txHash: e.txHash,
      logIndex: e.logIndex,
      eventType: e.eventType,
      error,
    });
  }
}
