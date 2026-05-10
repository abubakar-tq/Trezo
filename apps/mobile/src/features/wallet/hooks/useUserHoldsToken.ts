import { useWalletStore } from "@features/wallet/store/useWalletStore";

/**
 * Returns true only when the active wallet's token list contains `symbol` with
 * a non-zero balance (aggregated across all chains).
 *
 * On Unprovisioned / no-data cases, returns false.
 *
 * Data source: useWalletStore.balances — a flat TokenBalance[] populated by
 * useWalletData. Each entry has { symbol, balance, chain }.
 */
export function useUserHoldsToken(symbol: string): boolean {
  const balances = useWalletStore((s) => s.balances);

  return balances.some(
    (b) =>
      b.symbol.toUpperCase() === symbol.toUpperCase() &&
      parseFloat(b.balance) > 0,
  );
}
