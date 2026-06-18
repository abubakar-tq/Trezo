import { useState, useEffect, useMemo } from "react";
import { LIFI_BASE_URL, isLifiNetwork } from "@/src/features/swaps/lifi/constants";
import { getBridgeConfig } from "@/src/features/swaps/config/bridgeRegistry";
import { findNetworkByChainId, getNetworkConfig, type NetworkKey } from "@/src/integration/networks";

type LifiChainRaw = { id: number; chainType: string };
type LifiChainsResponse = { chains: LifiChainRaw[] };

// Module-level cache — one fetch per session regardless of how many components mount.
let lifiChainsCache: string[] | null = null;
let lifiChainsFetching: Promise<string[]> | null = null;

/** Pure helper — exported for testing. Returns testnet dest chain keys for a source. */
export function getTestnetDestChainKeys(sourceNetworkKey: string): string[] {
  const config = getBridgeConfig(sourceNetworkKey as NetworkKey);
  return config?.routes.map((r) => r.destinationNetworkKey as string) ?? [];
}

async function fetchLifiDestChains(sourceNetworkKey: string): Promise<string[]> {
  if (lifiChainsCache) return lifiChainsCache.filter((k) => k !== sourceNetworkKey);

  if (!lifiChainsFetching) {
    lifiChainsFetching = (async () => {
      try {
        const res = await fetch(`${LIFI_BASE_URL}/chains?chainTypes=EVM`);
        if (!res.ok) throw new Error(`LI.FI chains fetch failed (${res.status})`);
        const json = (await res.json()) as LifiChainsResponse;

        const keys: string[] = [];
        for (const chain of json.chains) {
          // Scan ALL registered networks (enabled or not) so bridge-dest-only
          // chains like eth-mainnet resolve even without wallet infrastructure.
          const network = findNetworkByChainId(chain.id);
          if (network && isLifiNetwork(network.networkKey)) {
            keys.push(network.networkKey);
          }
        }
        lifiChainsCache = keys;
        return keys;
      } catch (err) {
        lifiChainsFetching = null; // Clear so next call retries
        throw err;
      }
    })();
  }

  return lifiChainsFetching.then((keys) => keys.filter((k) => k !== sourceNetworkKey));
}

export function useBridgeDestChains(
  sourceNetworkKey: string,
  isMainnet: boolean,
): { destChainKeys: string[]; destChainLabels: Record<string, string>; loading: boolean } {
  const [destChainKeys, setDestChainKeys] = useState<string[]>(() => {
    if (!isMainnet) {
      return getTestnetDestChainKeys(sourceNetworkKey);
    }
    // Serve from cache synchronously if already fetched
    return lifiChainsCache
      ? lifiChainsCache.filter((k) => k !== sourceNetworkKey)
      : [];
  });
  const [loading, setLoading] = useState(isMainnet && !lifiChainsCache);

  useEffect(() => {
    if (!isMainnet) {
      setDestChainKeys(getTestnetDestChainKeys(sourceNetworkKey));
      setLoading(false);
      return;
    }

    if (lifiChainsCache) {
      setDestChainKeys(lifiChainsCache.filter((k) => k !== sourceNetworkKey));
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchLifiDestChains(sourceNetworkKey)
      .then((keys) => {
        setDestChainKeys(keys);
        setLoading(false);
      })
      .catch(() => {
        // Fallback: hardcoded known LI.FI mainnet keys so the picker and quote
        // still work even when the /chains endpoint is temporarily unavailable.
        const fallback = (["base-mainnet", "arb-mainnet", "eth-mainnet"] as string[])
          .filter((k) => k !== sourceNetworkKey);
        setDestChainKeys(fallback);
        setLoading(false);
      });
  }, [sourceNetworkKey, isMainnet]);

  const destChainLabels = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        destChainKeys.map((k) => {
          try {
            return [k, getNetworkConfig(k as NetworkKey).displayName];
          } catch {
            return [k, k];
          }
        }),
      ),
    [destChainKeys],
  );

  return { destChainKeys, destChainLabels, loading };
}
