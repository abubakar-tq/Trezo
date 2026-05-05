import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
    fetchEvmTokenPrices,
    MARKET_CHAINS,
    type EvmChain,
    type MarketSource,
    type MarketToken,
} from "@lib/api/web3Data";

type ChainCache = {
  tokens: MarketToken[];
  source: MarketSource | null;
  lastUpdated: number | null;
};

type MarketState = {
  loading: boolean;
  error: string | null;
  searchQuery: string;
  activeChain: EvmChain;
  chains: Record<EvmChain, ChainCache>;
  fetchMarketData: (options?: { chain?: EvmChain; force?: boolean }) => Promise<void>;
  setSearchQuery: (value: string) => void;
  setActiveChain: (chain: EvmChain) => void;
  clearError: () => void;
  warmCache: () => Promise<void>;
  hasWarmedCache: boolean;
};

const createInitialChains = (): Record<EvmChain, ChainCache> => {
  const chains = Object.keys(MARKET_CHAINS).reduce((acc, key) => {
    const chain = key as Exclude<EvmChain, "all">;
    acc[chain] = {
      tokens: [],
      source: null,
      lastUpdated: null,
    } satisfies ChainCache;
    return acc;
  }, {} as Record<Exclude<EvmChain, "all">, ChainCache>);
  
  // Add "all" chain cache
  return {
    ...chains,
    all: {
      tokens: [],
      source: null,
      lastUpdated: null,
    },
  } as Record<EvmChain, ChainCache>;
};

export const useMarketStore = create<MarketState>()(
  persist(
    (set, get) => ({
      loading: false,
      error: null,
      searchQuery: "",
      activeChain: "all",
      chains: createInitialChains(),
      hasWarmedCache: false,
      fetchMarketData: async (options) => {
        const { chain = get().activeChain, force = false } = options ?? {};
        
        // Skip fetching for "all" - it combines other chains
        if (chain === "all") {
          return;
        }
        
        const cache = get().chains[chain];
        const shouldUseCache = !force && cache?.tokens.length > 0;

        if (shouldUseCache) {
          return;
        }

        const shouldShowLoader = cache?.tokens.length === 0;
        set((state) => ({ loading: shouldShowLoader ? true : state.loading, error: null }));

        try {
          const { tokens, source } = await fetchEvmTokenPrices(chain, { force });
          set((state) => ({
            loading: false,
            error: null,
            chains: {
              ...state.chains,
              [chain]: {
                tokens,
                source,
                lastUpdated: Date.now(),
              },
            },
          }));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unable to load market data. Please try again.";
          set((state) => ({ loading: false, error: message }));
        }
      },
      setSearchQuery: (value) => set({ searchQuery: value }),
      setActiveChain: (chain) => {
        set((state) => (state.activeChain === chain ? state : { activeChain: chain }));
      },
      clearError: () => set({ error: null }),
      warmCache: async () => {
        const { hasWarmedCache } = get();
        if (hasWarmedCache) {
          return;
        }

        set({ hasWarmedCache: true });

        const chains = Object.keys(MARKET_CHAINS) as Array<Exclude<EvmChain, "all">>;
        
        // Fetch chains sequentially with delay to avoid rate limiting
        for (const chain of chains) {
          const chainCache = get().chains[chain];
          if (chainCache.tokens.length > 0) {
            continue;
          }

          try {
            const { tokens, source } = await fetchEvmTokenPrices(chain);
            if (tokens.length === 0) {
              continue;
            }
            set((state) => ({
              chains: {
                ...state.chains,
                [chain]: {
                  tokens,
                  source,
                  lastUpdated: Date.now(),
                },
              },
            }));
            
            // Add a small delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.warn(`Warm cache failed for ${chain}`, error);
          }
        }
      },
    }),
    {
      name: "Trezo_Wallet-market-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeChain: state.activeChain,
        chains: state.chains,
      }),
    },
  ),
);
