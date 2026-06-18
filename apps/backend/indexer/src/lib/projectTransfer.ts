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

type ReceivingWallet = {
  id: string;
  user_id: string;
  predicted_address: string;
  wallet_identity?: string | null;
  wallet_index?: number | null;
  deployment_mode?: "portable" | "chain-specific" | null;
  owner_address?: string | null;
  wallet_name?: string | null;
};

async function resolveReceivingWallet(
  networkKey: string,
  t: IncomingTransfer,
): Promise<ReceivingWallet | null> {
  const { data: wallet, error } = await supabase
    .from("aa_wallets")
    .select("id, user_id, predicted_address")
    .eq("network_key", networkKey)
    .ilike("predicted_address", t.to)
    .maybeSingle();

  if (error) {
    console.error("[indexer] wallet lookup failed", { networkKey, to: t.to, error });
  }
  if (wallet) return wallet as ReceivingWallet;

  const { data: portableWallet, error: portableError } = await supabase
    .from("aa_wallets")
    .select("id, user_id, predicted_address, wallet_identity, wallet_index, deployment_mode, owner_address, wallet_name")
    .ilike("predicted_address", t.to)
    .eq("deployment_mode", "portable")
    .limit(1)
    .maybeSingle();

  if (portableError) {
    console.error("[indexer] portable wallet lookup failed", { networkKey, to: t.to, error: portableError });
  }
  if (!portableWallet) return null;

  const source = portableWallet as ReceivingWallet;
  if (!source.owner_address) return source;

  const { data: created, error: insertError } = await supabase
    .from("aa_wallets")
    .insert({
      user_id: source.user_id,
      wallet_identity: source.wallet_identity ?? null,
      wallet_index: source.wallet_index ?? 0,
      deployment_mode: source.deployment_mode ?? "portable",
      predicted_address: source.predicted_address,
      owner_address: source.owner_address,
      wallet_name: source.wallet_name ?? "Passkey Smart Account",
      chain_id: t.chainId,
      network_key: networkKey,
      is_deployed: false,
    })
    .select("id, user_id, predicted_address")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: existing } = await supabase
        .from("aa_wallets")
        .select("id, user_id, predicted_address")
        .eq("network_key", networkKey)
        .ilike("predicted_address", t.to)
        .maybeSingle();
      return (existing as ReceivingWallet | null) ?? null;
    }

    console.error("[indexer] failed to create portable wallet network row", {
      networkKey,
      to: t.to,
      error: insertError,
    });
    return null;
  }

  return created as ReceivingWallet;
}

export async function projectIncomingTransfer(t: IncomingTransfer): Promise<void> {
  const networkKey = networkKeyForChain(t.chainId);
  if (!networkKey) return; // unknown chain — ignore

  // Resolve the receiving wallet → user_id. Only project transfers to known wallets.
  const wallet = await resolveReceivingWallet(networkKey, t);
  if (!wallet) return;

  const amountDisplay = formatUnits(t.valueRaw, t.tokenDecimals);

  const { error } = await supabase
    .from("wallet_transactions")
    .insert({
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
    });

  if (error && error.code !== "23505") {
    console.error("[indexer] projectIncomingTransfer failed", { txHash: t.txHash, error });
  }
}
