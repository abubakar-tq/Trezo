import { formatUnits } from "viem";
import { supabase } from "./supabase.js";
import { networkKeyForChain } from "./networkKeys.js";

export interface IncomingTransfer {
  chainId: number;
  txHash: string;
  logIndex: number;        // -1 for native
  from: string;
  to: string;              // the receiving smart account
  tokenType: "native" | "erc20";
  tokenAddress: string | null;
  tokenSymbol: string;
  tokenDecimals: number;
  valueRaw: bigint;
  blockNumber: bigint;
  blockTimestampSec: bigint;
}

export async function projectIncomingTransfer(t: IncomingTransfer): Promise<void> {
  const networkKey = networkKeyForChain(t.chainId);
  if (!networkKey) return; // unknown chain — ignore

  // Resolve the receiving wallet → user_id. Only project transfers to known wallets.
  const { data: wallet } = await supabase
    .from("aa_wallets")
    .select("id, user_id, predicted_address")
    .eq("network_key", networkKey)
    .ilike("predicted_address", t.to)
    .maybeSingle();
  if (!wallet) return;

  const amountDisplay = formatUnits(t.valueRaw, t.tokenDecimals);

  const { error } = await supabase
    .from("wallet_transactions")
    .upsert(
      {
        user_id: wallet.user_id,
        aa_wallet_id: wallet.id,
        wallet_address: wallet.predicted_address,
        chain_id: t.chainId,
        network_key: networkKey,
        type: t.tokenType === "native" ? "send_native" : "send_erc20",
        status: "confirmed",
        direction: "incoming",
        token_type: t.tokenType,
        token_address: t.tokenAddress,
        token_symbol: t.tokenSymbol,
        token_decimals: t.tokenDecimals,
        from_address: t.from,
        to_address: t.to,
        amount_raw: t.valueRaw.toString(),
        amount_display: amountDisplay,
        target_address: t.to,
        value_raw: t.tokenType === "native" ? t.valueRaw.toString() : "0",
        calldata: "0x",
        transaction_hash: t.txHash,
        log_index: t.logIndex,
        block_number: Number(t.blockNumber),
        confirmed_at: new Date(Number(t.blockTimestampSec) * 1000).toISOString(),
        metadata: { source: "indexer" },
      },
      { onConflict: "chain_id,transaction_hash,log_index", ignoreDuplicates: true },
    );

  if (error && error.code !== "23505") {
    console.error("[indexer] projectIncomingTransfer failed", { txHash: t.txHash, error });
  }
}
