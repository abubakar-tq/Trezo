import { useMemo } from "react";
import { useWalletStore } from "@features/wallet/store/useWalletStore";
import { getEnabledChains } from "@/src/integration/chains";

export type HoldingRow = {
  symbol: string;
  name: string;
  chainId: number;
  balance: string;
  valueUsd: number;
  decimals: number;
  address: string; // contract address or "native"
};

/**
 * Derives non-zero holdings from the wallet store, sorted by USD value descending.
 * TokenBalance.chain is a string name (e.g. "Anvil") — we match it against enabled
 * chains to resolve a numeric chainId.
 */
export function useHoldingsAcrossChains(): HoldingRow[] {
  const balances = useWalletStore((s) => s.balances) ?? [];

  return useMemo(() => {
    const enabledChains = getEnabledChains();

    // Build a name→chainId lookup for matching
    const nameToChainId = new Map<string, number>(
      enabledChains.map((c) => [c.name.toLowerCase(), c.id]),
    );

    return balances
      .filter((b) => Number(b.balance ?? 0) > 0)
      .flatMap((b) => {
        const chainId =
          nameToChainId.get((b.chain ?? "").toLowerCase()) ??
          // Fallback: check if chain is already a numeric string
          (Number.isFinite(Number(b.chain)) && Number(b.chain) > 0
            ? Number(b.chain)
            : null);

        if (chainId === null) return [];

        return [
          {
            symbol: b.symbol,
            name: b.name ?? b.symbol,
            chainId,
            balance: b.balance,
            valueUsd: Number(b.valueUsd ?? 0),
            decimals: b.decimals,
            address: b.address,
          } satisfies HoldingRow,
        ];
      })
      .sort((a, b) => b.valueUsd - a.valueUsd);
  }, [balances]);
}
