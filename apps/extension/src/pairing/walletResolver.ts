import { supabase } from "../auth/supabaseClient";

export type ChainWallet = { address: `0x${string}`; chainId: number; isDeployed: boolean };

export const WalletResolver = {
  async getForChain(userId: string, chainId: number): Promise<ChainWallet | null> {
    try {
      const { data } = await supabase.from("aa_wallets")
        .select("predicted_address, chain_id, is_deployed")
        .eq("user_id", userId).eq("chain_id", chainId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!data?.predicted_address) return null;
      return { address: data.predicted_address as `0x${string}`, chainId, isDeployed: Boolean(data.is_deployed) };
    } catch (e) {
      // A stale/expired Supabase session can throw while resolving the access
      // token. Treat as "no wallet" rather than crashing the caller.
      console.warn("[WalletResolver] getForChain failed (non-fatal):", e);
      return null;
    }
  },
  async listChains(userId: string): Promise<number[]> {
    try {
      const { data } = await supabase.from("aa_wallets")
        .select("chain_id, is_deployed").eq("user_id", userId);
      return (data ?? []).filter((r: any) => r.is_deployed).map((r: any) => r.chain_id as number);
    } catch (e) {
      console.warn("[WalletResolver] listChains failed (non-fatal):", e);
      return [];
    }
  },
};
