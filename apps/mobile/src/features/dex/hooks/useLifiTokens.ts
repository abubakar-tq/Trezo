/**
 * useLifiTokens
 *
 * Returns two token lists for a network key:
 *
 *   topTokens  — the static registry (curated, ~15 tokens). Always available instantly.
 *                Used for the default picker display so the user sees meaningful tokens
 *                without waiting for an API call.
 *
 *   tokens     — the full LI.FI-routable catalogue merged with the static registry (~400+).
 *                Available after the first API call resolves. Used for search.
 *
 * For non-LI.FI networks both lists are identical (static registry only, no fetch).
 * Concurrent renders for the same network share a single in-flight request via
 * LifiTokenService's internal dedup.
 */

import { useState, useEffect, useMemo } from "react";
import type { TokenMetadata } from "@/src/features/assets/types/token";
import type { NetworkKey } from "@/src/integration/networks";
import { isLifiNetwork } from "@/src/features/swaps/lifi/constants";
import { LifiTokenService } from "@/src/features/swaps/lifi/LifiTokenService";
import { TokenRegistryService } from "@/src/features/assets/services/TokenRegistryService";

export type UseLifiTokensResult = {
  /** Curated top tokens — shown in the picker by default, available instantly. */
  topTokens: TokenMetadata[];
  /** Full LI.FI catalogue — used for in-picker search. Falls back to topTokens until loaded. */
  tokens: TokenMetadata[];
  /** True while the background LI.FI API call is in flight. */
  loading: boolean;
};

export function useLifiTokens(networkKey: NetworkKey): UseLifiTokensResult {
  const topTokens = useMemo(
    () => TokenRegistryService.listSwapTokensForNetwork(networkKey),
    [networkKey],
  );

  const [lifiTokens, setLifiTokens] = useState<TokenMetadata[] | null>(null);
  const [loading, setLoading] = useState(() => isLifiNetwork(networkKey));

  useEffect(() => {
    if (!isLifiNetwork(networkKey)) {
      setLifiTokens(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    LifiTokenService.getTokensForNetwork(networkKey)
      .then((fetched) => {
        if (!cancelled) {
          setLifiTokens(fetched);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("[useLifiTokens] Failed to fetch LI.FI tokens, search will use static list:", err);
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [networkKey]);

  const tokens = useMemo(() => {
    if (!isLifiNetwork(networkKey) || lifiTokens === null) {
      return topTokens;
    }

    // Native ETH always comes from the static registry (LI.FI returns address(0) for it)
    const nativeTokens = topTokens.filter((t) => t.type === "native");

    // Build address set from LI.FI ERC20s
    const lifiAddresses = new Set(
      lifiTokens
        .filter((t) => t.type === "erc20")
        .map((t) => (t as Extract<TokenMetadata, { type: "erc20" }>).address.toLowerCase()),
    );

    // Keep static-only entries that LI.FI didn't return (edge case)
    const staticOnlyErc20s = topTokens.filter(
      (t) =>
        t.type === "erc20" &&
        !lifiAddresses.has(
          (t as Extract<TokenMetadata, { type: "erc20" }>).address.toLowerCase(),
        ),
    );

    return [...nativeTokens, ...lifiTokens, ...staticOnlyErc20s];
  }, [networkKey, topTokens, lifiTokens]);

  return { topTokens, tokens, loading };
}
