import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type BrowserFavorite = {
  label: string;
  url: string;
  icon: string;
  addedAt: number;
};

export type BrowserTab = {
  id: string;
  url: string;
  title: string;
  createdAt: number;
  lastAccessed: number;
};

export type BrowserHistoryEntry = {
  id: string;
  url: string;
  title: string;
  visitedAt: number;
};

export type BrowserSettings = {
  persistTabs: boolean;
  historyLimit: number;
  searchEngine: "web3compass-duckduckgo" | "duckduckgo" | "google";
};

type BrowserStoreState = {
  // Favorites
  favorites: BrowserFavorite[];
  addFavorite: (favorite: BrowserFavorite) => void;
  removeFavorite: (url: string) => void;

  // Tabs
  tabs: BrowserTab[];
  activeTabId: string | null;
  addTab: (url?: string, title?: string) => string;
  removeTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Omit<BrowserTab, "id">>) => void;
  setActiveTab: (tabId: string) => void;
  closeAllTabs: () => void;

  // History
  history: BrowserHistoryEntry[];
  addToHistory: (url: string, title: string) => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;

  // Settings
  settings: BrowserSettings;
  updateSettings: (updates: Partial<BrowserSettings>) => void;
};

const defaultFavoritesBase: Array<Omit<BrowserFavorite, "addedAt">> = [
  { label: "Trezo", url: "https://trezo.app", icon: "zap" },
  { label: "Uniswap", url: "https://app.uniswap.org", icon: "sliders" },
  { label: "Aave", url: "https://app.aave.com", icon: "aperture" },
  { label: "OpenSea", url: "https://opensea.io", icon: "compass" },
  { label: "Etherscan", url: "https://etherscan.io", icon: "activity" },
];

const defaultFavorites: BrowserFavorite[] = defaultFavoritesBase.map((favorite, index) => ({
  ...favorite,
  addedAt: Date.now() + index,
}));

const DEFAULT_HOME = "https://app.uniswap.org";
const MAX_TABS = 10;

const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useBrowserStore = create<BrowserStoreState>()(
  persist(
    (set, get) => ({
      // Favorites
      favorites: defaultFavorites,
      addFavorite: (favorite) =>
        set((state) => {
          if (state.favorites.some((item) => item.url === favorite.url)) {
            return state;
          }
          return {
            favorites: [...state.favorites, { ...favorite, addedAt: favorite.addedAt ?? Date.now() }],
          };
        }),
      removeFavorite: (url) =>
        set((state) => ({
          favorites: state.favorites.filter((item) => item.url !== url),
        })),

      // Tabs
      tabs: [],
      activeTabId: null,

      addTab: (url = DEFAULT_HOME, title = "New Tab") => {
        const state = get();
        
        // Limit max tabs
        if (state.tabs.length >= MAX_TABS) {
          console.warn(`Maximum ${MAX_TABS} tabs reached`);
          return state.activeTabId ?? "";
        }

        const newTab: BrowserTab = {
          id: generateTabId(),
          url,
          title,
          createdAt: Date.now(),
          lastAccessed: Date.now(),
        };

        set({
          tabs: [...state.tabs, newTab],
          activeTabId: newTab.id,
        });

        return newTab.id;
      },

      removeTab: (tabId) =>
        set((state) => {
          const remainingTabs = state.tabs.filter((tab) => tab.id !== tabId);
          
          // If we removed the active tab, select another one
          let newActiveId = state.activeTabId;
          if (state.activeTabId === tabId) {
            if (remainingTabs.length > 0) {
              // Select the most recently accessed tab
              const sorted = [...remainingTabs].sort((a, b) => b.lastAccessed - a.lastAccessed);
              newActiveId = sorted[0].id;
            } else {
              newActiveId = null;
            }
          }

          return {
            tabs: remainingTabs,
            activeTabId: newActiveId,
          };
        }),

      updateTab: (tabId, updates) =>
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId
              ? { ...tab, ...updates, lastAccessed: Date.now() }
              : tab
          ),
        })),

      setActiveTab: (tabId) =>
        set((state) => {
          const tab = state.tabs.find((t) => t.id === tabId);
          if (!tab) return state;

          return {
            activeTabId: tabId,
            tabs: state.tabs.map((t) =>
              t.id === tabId ? { ...t, lastAccessed: Date.now() } : t
            ),
          };
        }),

      closeAllTabs: () =>
        set({
          tabs: [],
          activeTabId: null,
        }),

      // History
      history: [],

      addToHistory: (url, title) =>
        set((state) => {
          // Skip adding to history if URL is invalid or dangerous
          if (!url || /^(javascript|data|file|about|mailto|tel|sms|intent):/i.test(url)) {
            return state;
          }

          const newEntry: BrowserHistoryEntry = {
            id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url,
            title: title || url,
            visitedAt: Date.now(),
          };

          // Remove duplicates (same URL within last hour)
          const oneHourAgo = Date.now() - 3600000;
          const filteredHistory = state.history.filter(
            (entry) => !(entry.url === url && entry.visitedAt > oneHourAgo)
          );

          // Add new entry and respect history limit
          const updatedHistory = [newEntry, ...filteredHistory];
          const limit = state.settings.historyLimit;

          return {
            history: updatedHistory.slice(0, limit),
          };
        }),

      clearHistory: () =>
        set({
          history: [],
        }),

      removeFromHistory: (id) =>
        set((state) => ({
          history: state.history.filter((entry) => entry.id !== id),
        })),

      // Settings
      settings: {
        persistTabs: false,
        historyLimit: 30,
        searchEngine: "duckduckgo",
      },

      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),
    }),
    {
      name: "trezo-browser-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        // Always persist favorites, history, and settings
        const base = {
          favorites: state.favorites,
          history: state.history,
          settings: state.settings,
        };

        // Only persist tabs if setting is enabled
        if (state.settings.persistTabs) {
          return {
            ...base,
            tabs: state.tabs,
            activeTabId: state.activeTabId,
          };
        }

        return base;
      },
    },
  ),
);

export const sanitizeBrowserUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "https://app.uniswap.org";
  }
  const cleaned = trimmed.replace(/[\s\u0000-\u001F\u007F]+/g, "");
  if (/^(javascript|data|file|about|mailto|tel|sms|intent):/i.test(cleaned)) {
    return "https://app.uniswap.org";
  }
  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }
  return `https://${cleaned}`;
};

/**
 * Determines if input looks like a URL or search query
 */
export const isUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (trimmed.includes(" ")) return false;
  return trimmed.includes(".");
};

/**
 * Well-known dApp shortcuts — exact-match on the trimmed lowercase query
 * navigates directly to the dApp rather than going through a search engine.
 */
const DAPP_SHORTCUTS: Record<string, string> = {
  "uniswap":      "https://app.uniswap.org",
  "pancakeswap":  "https://pancakeswap.finance",
  "sushiswap":    "https://www.sushi.com",
  "aave":         "https://app.aave.com",
  "compound":     "https://app.compound.finance",
  "curve":        "https://curve.fi",
  "balancer":     "https://app.balancer.fi",
  "1inch":        "https://app.1inch.io",
  "lido":         "https://lido.fi",
  "maker":        "https://makerdao.com",
  "dydx":         "https://dydx.exchange",
  "gmx":          "https://gmx.io",
  "opensea":      "https://opensea.io",
  "rarible":      "https://rarible.com",
  "etherscan":    "https://etherscan.io",
  "basescan":     "https://basescan.org",
  "arbiscan":     "https://arbiscan.io",
  "metamask":     "https://metamask.io",
  "rainbow":      "https://rainbow.me",
  "zapper":       "https://zapper.xyz",
  "debank":       "https://debank.com",
};

export const buildSearchUrl = (query: string, engine: "web3compass-duckduckgo" | "duckduckgo" | "google" = "duckduckgo"): string => {
  const trimmed = query.trim();
  if (!trimmed) return "https://app.uniswap.org";

  const encoded = encodeURIComponent(trimmed);

  if (engine === "google") {
    return `https://www.google.com/search?q=${encoded}`;
  }

  // Both "duckduckgo" and legacy "web3compass-duckduckgo" use DuckDuckGo —
  // web3compass.xyz is an onboarding guide, not a search engine.
  return `https://duckduckgo.com/?q=${encoded}`;
};

/**
 * Convert user input to a destination URL.
 * Exact-match dApp shortcuts navigate directly; everything else searches.
 */
export const toDestination = (value: string, searchEngine: "web3compass-duckduckgo" | "duckduckgo" | "google" = "duckduckgo"): string => {
  if (isUrl(value)) {
    return sanitizeBrowserUrl(value);
  }
  const shortcut = DAPP_SHORTCUTS[value.trim().toLowerCase()];
  if (shortcut) return shortcut;
  return buildSearchUrl(value, searchEngine);
};
