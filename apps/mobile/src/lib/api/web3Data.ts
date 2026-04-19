import { MORALIS_API_KEY as ENV_MORALIS_API_KEY } from "@env";
// import type { CoinFullInfo } from "coingecko-api-v3/dist/Interface"; // Temporarily disabled

export type MarketSource = "moralis" | "coingecko";

export type EvmChain =
  | "ethereum"
  | "polygon"
  | "bsc"
  | "arbitrum"
  | "optimism"
  | "base"
  | "avalanche"
  | "all";

export type MarketToken = {
  chain: Exclude<EvmChain, "all">;
  network: string;
  address: string;
  name: string;
  symbol: string;
  priceUsd: number;
  change24h: number | null;
};

export type TokenPriceResponse = {
  tokens: MarketToken[];
  source: MarketSource;
};

export type TokenPrice = {
  address: string;
  symbol: string;
  name: string;
  chain: EvmChain;
  priceUsd: number;
  change24h: number | null;
  source: MarketSource;
};

export type TokenSearchResult = {
  address: string;
  chain: EvmChain;
  symbol: string;
  name: string;
  logo?: string | null;
};

export type DiscoveryToken = {
  address: string;
  chain: EvmChain;
  symbol: string;
  name: string;
  description?: string;
  tags?: string[];
  logo?: string | null;
  url?: string | null;
};

export type TokenMarketDetail = {
  token: MarketToken;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  high24h: number | null;
  low24h: number | null;
  description: string | null;
  image: string | null;
  lastUpdated: string | null;
  source: MarketSource;
};

type CoinFullInfo = {
  last_updated?: string;
  description?: {
    en?: string;
  };
  image?: {
    small?: string;
    large?: string;
  };
  market_data?: {
    last_updated?: string;
    market_cap?: {
      usd?: number;
    };
    total_volume?: {
      usd?: number;
    };
    high_24h?: {
      usd?: number;
    };
    low_24h?: {
      usd?: number;
    };
  };
};

const MORALIS_BASE_URL = "https://deep-index.moralis.io/api/v2.2";
const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

const CACHE_DURATION_MS = 60_000;
const SEARCH_CACHE_DURATION_MS = 45_000;

const ZERO_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

// Helper to check if a chain is a specific chain (not "all")
const isSpecificChain = (chain: EvmChain): chain is Exclude<EvmChain, "all"> => {
  return chain !== "all";
};


export const MARKET_CHAINS: Record<
  Exclude<EvmChain, "all">,
  {
    label: string;
    moralisChain: string;
    coingeckoPlatform: string;
  }
> = {
  ethereum: { label: "Ethereum", moralisChain: "eth", coingeckoPlatform: "ethereum" },
  polygon: { label: "Polygon", moralisChain: "polygon", coingeckoPlatform: "polygon-pos" },
  bsc: { label: "BNB Chain", moralisChain: "bsc", coingeckoPlatform: "binance-smart-chain" },
  arbitrum: { label: "Arbitrum", moralisChain: "arbitrum", coingeckoPlatform: "arbitrum-one" },
  optimism: { label: "Optimism", moralisChain: "optimism", coingeckoPlatform: "optimistic-ethereum" },
  base: { label: "Base", moralisChain: "base", coingeckoPlatform: "base" },
  avalanche: { label: "Avalanche", moralisChain: "avalanche", coingeckoPlatform: "avalanche" },
};

export const MARKET_CHAIN_OPTIONS = [
  { key: "all" as EvmChain, label: "All Chains" },
  ...Object.entries(MARKET_CHAINS).map(([key, value]) => ({
    key: key as EvmChain,
    label: value.label,
  })),
];

type TokenConfig = {
  chain: Exclude<EvmChain, "all">;
  address: string;
  symbol: string;
  name: string;
  coingeckoId: string;
};

const TOKEN_DIRECTORY: Record<Exclude<EvmChain, "all">, TokenConfig[]> = {
  ethereum: [
    { chain: "ethereum", address: ZERO_ADDRESS, symbol: "ETH", name: "Ethereum", coingeckoId: "ethereum" },
    {
      chain: "ethereum",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      symbol: "USDC",
      name: "USD Coin",
      coingeckoId: "usd-coin",
    },
    {
      chain: "ethereum",
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      symbol: "USDT",
      name: "Tether",
      coingeckoId: "tether",
    },
    {
      chain: "ethereum",
      address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      coingeckoId: "wrapped-bitcoin",
    },
    {
      chain: "ethereum",
      address: "0x514910771af9ca656af840dff83e8264ecf986ca",
      symbol: "LINK",
      name: "Chainlink",
      coingeckoId: "chainlink",
    },
    {
      chain: "ethereum",
      address: "0xb4efd85c19999d84251304bda99e90b92300bd93",
      symbol: "RPL",
      name: "Rocket Pool",
      coingeckoId: "rocket-pool",
    },
  ],
  polygon: [
    {
      chain: "polygon",
      address: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
      symbol: "WMATIC",
      name: "Wrapped Matic",
      coingeckoId: "wmatic",
    },
    {
      chain: "polygon",
      address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
      symbol: "USDC",
      name: "USD Coin (Bridged)",
      coingeckoId: "usd-coin",
    },
    {
      chain: "polygon",
      address: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
      symbol: "WETH",
      name: "Wrapped Ether",
      coingeckoId: "weth",
    },
    {
      chain: "polygon",
      address: "0xd6df932a45c0f255f85145f286ea0b292b21c90b",
      symbol: "AAVE",
      name: "Aave",
      coingeckoId: "aave",
    },
    {
      chain: "polygon",
      address: "0xbbba073c31bf03b8acf7c28ef0738decf3695683",
      symbol: "SAND",
      name: "The Sandbox",
      coingeckoId: "the-sandbox",
    },
  ],
  bsc: [
    { chain: "bsc", address: ZERO_ADDRESS, symbol: "BNB", name: "BNB", coingeckoId: "binancecoin" },
    {
      chain: "bsc",
      address: "0xe9e7cea3dedca5984780bafc599bd69add087d56",
      symbol: "BUSD",
      name: "Binance USD",
      coingeckoId: "binance-usd",
    },
    {
      chain: "bsc",
      address: "0x55d398326f99059ff775485246999027b3197955",
      symbol: "USDT",
      name: "Tether USD",
      coingeckoId: "tether",
    },
    {
      chain: "bsc",
      address: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
      symbol: "CAKE",
      name: "PancakeSwap",
      coingeckoId: "pancakeswap-token",
    },
    {
      chain: "bsc",
      address: "0x2170ed0880ac9a755fd29b2688956bd959f933f8",
      symbol: "ETH",
      name: "Ethereum (BSC)",
      coingeckoId: "ethereum",
    },
  ],
  arbitrum: [
    { chain: "arbitrum", address: ZERO_ADDRESS, symbol: "ETH", name: "Ether (Arbitrum)", coingeckoId: "ethereum" },
    {
      chain: "arbitrum",
      address: "0x912ce59144191c1204e64559fe8253a0e49e6548",
      symbol: "ARB",
      name: "Arbitrum",
      coingeckoId: "arbitrum",
    },
    {
      chain: "arbitrum",
      address: "0xfc5a1a6eb076a2c7ad06ed22c90d7edda426d9c7",
      symbol: "GMX",
      name: "GMX",
      coingeckoId: "gmx",
    },
    {
      chain: "arbitrum",
      address: "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
      symbol: "USDC",
      name: "USD Coin (Arbitrum)",
      coingeckoId: "usd-coin",
    },
    {
      chain: "arbitrum",
      address: "0x539bde0d7dbd336b79148aa742883198bbf60342",
      symbol: "MAGIC",
      name: "Treasure",
      coingeckoId: "magic",
    },
  ],
  optimism: [
    { chain: "optimism", address: ZERO_ADDRESS, symbol: "ETH", name: "Ether (Optimism)", coingeckoId: "ethereum" },
    {
      chain: "optimism",
      address: "0x4200000000000000000000000000000000000042",
      symbol: "OP",
      name: "Optimism",
      coingeckoId: "optimism",
    },
    {
      chain: "optimism",
      address: "0x7f5c764cbc14f9669b88837ca1490cca17c31607",
      symbol: "USDC",
      name: "USD Coin (Optimism)",
      coingeckoId: "usd-coin",
    },
    {
      chain: "optimism",
      address: "0x68f180fcce6836688e9084f035309e29bf0a2095",
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      coingeckoId: "wrapped-bitcoin",
    },
    {
      chain: "optimism",
      address: "0x8700daec35af8ff88c16bdf041c9fc4d075e3fbb",
      symbol: "SNX",
      name: "Synthetix",
      coingeckoId: "synthetix-network-token",
    },
  ],
  base: [
    { chain: "base", address: ZERO_ADDRESS, symbol: "ETH", name: "Ether (Base)", coingeckoId: "ethereum" },
    {
      chain: "base",
      address: "0x833589fcd6edb6e08f4c7c39f7efa63e88f4a41d",
      symbol: "USDC",
      name: "USD Coin (Base)",
      coingeckoId: "usd-coin",
    },
    {
      chain: "base",
      address: "0x2ae3f1bfff704f708fb88172ff08805f20cfeaf5",
      symbol: "cbETH",
      name: "Coinbase Wrapped Staked ETH",
      coingeckoId: "coinbase-wrapped-staked-eth",
    },
    {
      chain: "base",
      address: "0x9a3077c68485f6fbbd4ef062bf0a58a2d46c1c0d",
      symbol: "DEGEN",
      name: "Degen",
      coingeckoId: "degen-base",
    },
    {
      chain: "base",
      address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
      symbol: "AERO",
      name: "Aerodrome",
      coingeckoId: "aerodrome-finance",
    },
  ],
  avalanche: [
    { chain: "avalanche", address: ZERO_ADDRESS, symbol: "AVAX", name: "Avalanche", coingeckoId: "avalanche-2" },
    {
      chain: "avalanche",
      address: "0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664",
      symbol: "USDC.e",
      name: "USD Coin (Bridged)",
      coingeckoId: "usd-coin",
    },
    {
      chain: "avalanche",
      address: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
      symbol: "WAVAX",
      name: "Wrapped AVAX",
      coingeckoId: "wrapped-avax",
    },
    {
      chain: "avalanche",
      address: "0x152b9d0fdc40c096757f570a51e494bd4b943e50",
      symbol: "BTC.b",
      name: "Bitcoin (Avalanche)",
      coingeckoId: "bitcoin",
    },
    {
      chain: "avalanche",
      address: "0x6e84a6216eac5b8c3fcd08c5e7f73bebba93bd4f",
      symbol: "JOE",
      name: "Trader Joe",
      coingeckoId: "joe",
    },
  ],
};

type MoralisPriceRow = {
  tokenAddress: string;
  usdPrice?: number;
  usdPrice24hrAgo?: number;
  usdPrice_percent_change_24h?: number;
  usdPricePercentChange24h?: number;
  percentChange24h?: number;
  stats?: {
    usdPrice24hrAgo?: number;
    usdPrice_percent_change_24h?: number;
    percentChange24h?: number;
  };
};

type MoralisTopToken = {
  token_address: string;
  symbol: string;
  name: string;
  chain: string;
  usd_price: number;
  percent_change_24h?: number;
};

type MoralisSearchToken = {
  token_address: string;
  name: string;
  symbol: string;
  chain: string;
  logo?: string;
};

type MoralisDiscoveryToken = {
  token_address: string;
  name: string;
  symbol: string;
  chain: string;
  description?: string;
  tags?: string[];
  project_url?: string;
  logo?: string;
};

const mapMoralisChainToEvm = (value: string): Exclude<EvmChain, "all"> | null => {
  const entry = Object.entries(MARKET_CHAINS).find(([, meta]) => meta.moralisChain === value);
  return (entry?.[0] as Exclude<EvmChain, "all"> | undefined) ?? null;
};

const resolveMoralisApiKey = (): string | null => {
  const fromProcess = typeof process !== "undefined" ? process.env?.MORALIS_API_KEY : undefined;
  const key = fromProcess ?? ENV_MORALIS_API_KEY;
  if (!key) {
    console.warn('⚠️ MORALIS_API_KEY not found in environment variables');
    return null;
  }
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    console.warn('⚠️ MORALIS_API_KEY is empty');
    return null;
  }
  // Log first few characters to verify key is loaded (don't log full key for security)
  console.log(`✅ Moralis API key loaded (${trimmed.substring(0, 10)}...)`);
  return trimmed;
};

type CacheEntry<T> = {
  timestamp: number;
  data: T;
  source: MarketSource;
};

const priceCache = new Map<EvmChain, CacheEntry<MarketToken[]>>();
const topTokensCache = new Map<string, CacheEntry<MarketToken[]>>();
const searchCache = new Map<string, CacheEntry<TokenSearchResult[]>>();
const discoveryCache = new Map<string, CacheEntry<DiscoveryToken[]>>();

const extractPercentChange = (row: MoralisPriceRow, current: number | undefined): number | null => {
  const candidates = [
    row.usdPricePercentChange24h,
    row.usdPrice_percent_change_24h,
    row.percentChange24h,
    row.stats?.usdPrice_percent_change_24h,
    row.stats?.percentChange24h,
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (candidates.length > 0) {
    return candidates[0];
  }

  const previous = row.usdPrice24hrAgo ?? row.stats?.usdPrice24hrAgo;
  if (typeof current === "number" && typeof previous === "number" && previous > 0) {
    return ((current - previous) / previous) * 100;
  }

  return null;
};

type MoralisTokenPriceResult = {
  usdPrice?: number;
  usd_price?: number;
  usdPricePercentChange24h?: number;
  usdPrice_percent_change_24h?: number;
  usdPrice24hrAgo?: number;
  priceChange?: { h24?: number } | null;
};

const parseMoralisTokenPrice = (
  raw: MoralisTokenPriceResult | undefined,
): { priceUsd: number; change24h: number | null } | null => {
  if (!raw) {
    return null;
  }

  const priceCandidate =
    typeof raw.usdPrice === "number"
      ? raw.usdPrice
      : typeof raw.usd_price === "number"
        ? raw.usd_price
        : undefined;

  if (typeof priceCandidate !== "number" || !Number.isFinite(priceCandidate)) {
    return null;
  }

  const changeCandidate =
    typeof raw.usdPricePercentChange24h === "number"
      ? raw.usdPricePercentChange24h
      : typeof raw.usdPrice_percent_change_24h === "number"
        ? raw.usdPrice_percent_change_24h
        : typeof raw.priceChange?.h24 === "number"
          ? raw.priceChange.h24
          : raw.usdPrice24hrAgo && raw.usdPrice24hrAgo > 0
            ? ((priceCandidate - raw.usdPrice24hrAgo) / raw.usdPrice24hrAgo) * 100
            : null;

  return {
    priceUsd: priceCandidate,
    change24h: typeof changeCandidate === "number" && Number.isFinite(changeCandidate) ? changeCandidate : null,
  };
};

const requestMoralisTokenPrice = async (
  token: TokenConfig,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ priceUsd: number; change24h: number | null } | null> => {
  const lower = token.address.toLowerCase();
  if (lower === ZERO_ADDRESS) {
    return null;
  }

  const params = new URLSearchParams({ chain: MARKET_CHAINS[token.chain].moralisChain });
  
  try {
    const response = await fetch(`${MORALIS_BASE_URL}/erc20/${lower}/price?${params}`, {
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`Moralis price request failed (${response.status})`);
    }

    const payload: MoralisTokenPriceResult = await response.json();
    return parseMoralisTokenPrice(payload);
  } catch (error) {
    // Network errors should be propagated to trigger CoinGecko fallback
    throw error;
  }
};

const mergeMarketTokenResults = (...entries: MarketToken[][]): MarketToken[] => {
  const map = new Map<string, MarketToken>();
  entries.forEach((list) => {
    list.forEach((token) => {
      map.set(token.address.toLowerCase(), token);
    });
  });
  return Array.from(map.values());
};

const sanitizeRichText = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const withoutHtml = value.replace(/<[^>]+>/g, " ");
  const normalized = withoutHtml.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
};

const isAbortError = (error: unknown): boolean => {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }
  if (typeof error === "object" && error !== null && "name" in error) {
    return String((error as { name?: string }).name) === "AbortError";
  }
  return false;
};

const ensureCached = <T>(
  cache: Map<string, CacheEntry<T>> | Map<EvmChain, CacheEntry<T>>,
  key: string | EvmChain,
  ttl = CACHE_DURATION_MS,
): CacheEntry<T> | null => {
  const entry = cache.get(key as never) ?? null;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttl) {
    cache.delete(key as never);
    return null;
  }
  return entry;
};

const setCache = <T>(
  cache: Map<string, CacheEntry<T>> | Map<EvmChain, CacheEntry<T>>,
  key: string | EvmChain,
  data: T,
  source: MarketSource,
) => {
  cache.set(key as never, { data, source, timestamp: Date.now() });
};

const fetchCoinGeckoPrices = async (
  chain: Exclude<EvmChain, "all">,
  subset?: TokenConfig[],
  signal?: AbortSignal,
): Promise<MarketToken[]> => {
  const tokens = subset?.length ? subset : TOKEN_DIRECTORY[chain];
  if (!tokens || tokens.length === 0) {
    return [];
  }

  const ids = Array.from(new Set(tokens.map((token: TokenConfig) => token.coingeckoId))).join(",");
  const query = new URLSearchParams({
    vs_currency: "usd",
    ids,
    price_change_percentage: "24h",
  });

  const response = await fetch(`${COINGECKO_BASE_URL}/coins/markets?${query}`, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`CoinGecko request failed (${response.status})`);
  }

  const data: Array<{
    id: string;
    name: string;
    symbol: string;
    current_price: number;
    price_change_percentage_24h?: number | null;
  }> = await response.json();

  return tokens.map((token: TokenConfig) => {
    const entry = data.find((item) => item.id === token.coingeckoId);
    return {
      chain: token.chain,
      network: MARKET_CHAINS[token.chain].label,
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      priceUsd: entry?.current_price ?? 0,
      change24h:
        typeof entry?.price_change_percentage_24h === "number"
          ? entry.price_change_percentage_24h
          : null,
    } satisfies MarketToken;
  });
};

const findTokenConfig = (chain: Exclude<EvmChain, "all">, address: string): TokenConfig | null => {
  const tokens = TOKEN_DIRECTORY[chain] ?? [];
  const lower = address.toLowerCase();
  return tokens.find((token: TokenConfig) => token.address.toLowerCase() === lower) ?? null;
};

const fetchMoralisTokenPrices = async (
  chain: Exclude<EvmChain, "all">,
  apiKey: string,
  signal?: AbortSignal,
): Promise<MarketToken[]> => {
  const tokens = TOKEN_DIRECTORY[chain];
  if (!tokens || tokens.length === 0) {
    return [];
  }

  // Track how many consecutive failures we get
  let failureCount = 0;
  const MAX_FAILURES_BEFORE_FALLBACK = 3;

  const moralisResults = await Promise.all(
    tokens.map(async (token: TokenConfig) => {
      // If we've had too many failures, skip remaining Moralis requests
      if (failureCount >= MAX_FAILURES_BEFORE_FALLBACK) {
        return null;
      }

      try {
        const parsed = await requestMoralisTokenPrice(token, apiKey, signal);

        if (!parsed) {
          return null;
        }

        return {
          chain: token.chain,
          network: MARKET_CHAINS[token.chain].label,
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          priceUsd: parsed.priceUsd,
          change24h: parsed.change24h,
        } satisfies MarketToken;
      } catch (error) {
        failureCount++;
        
        // Only log first few failures to avoid console spam
        if (failureCount <= 3) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('Network request failed')) {
            console.warn(`⚠️ Moralis network unavailable for ${token.symbol} (${token.chain}), will use CoinGecko fallback`);
          } else {
            console.warn(`Moralis price fetch failed for ${token.symbol} (${token.chain})`, error);
          }
        }
        return null;
      }
    }),
  );

  const available = moralisResults.filter((item): item is MarketToken => item !== null);

  // If we got mostly failures, don't try CoinGecko completion - just throw to trigger full CoinGecko fetch
  if (failureCount >= MAX_FAILURES_BEFORE_FALLBACK && available.length === 0) {
    throw new Error('Moralis API unavailable');
  }

  const missing = tokens.filter(
    (token: TokenConfig) => !available.some((item: MarketToken) => item.address.toLowerCase() === token.address.toLowerCase()),
  );

  if (missing.length === 0) {
    return available;
  }

  try {
    const fallback = await fetchCoinGeckoPrices(chain, missing, signal);
    return mergeMarketTokenResults(available, fallback);
  } catch (error) {
    console.warn("CoinGecko fallback failed while completing Moralis data", error);
    return available;
  }
};

export type FetchPricesOptions = {
  signal?: AbortSignal;
  force?: boolean;
};

export const fetchEvmTokenPrices = async (
  chain: Exclude<EvmChain, "all">,
  options: FetchPricesOptions = {},
): Promise<TokenPriceResponse> => {
  const { force = false, signal } = options;
  const cached = ensureCached(priceCache, chain, CACHE_DURATION_MS);
  if (!force && cached) {
    return { tokens: cached.data, source: cached.source };
  }

  const apiKey = resolveMoralisApiKey();

  // Try Moralis first if API key is available
  if (apiKey) {
    try {
      const moralisTokens = await fetchMoralisTokenPrices(chain, apiKey, signal);
      if (moralisTokens.length > 0) {
        setCache(priceCache, chain, moralisTokens, "moralis");
        return { tokens: moralisTokens, source: "moralis" };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Network request failed') || errorMessage.includes('Moralis API unavailable')) {
        console.warn(`⚠️ Moralis unavailable for ${chain}, falling back to CoinGecko`);
      } else {
        console.warn(`Moralis price fetch failed for ${chain}`, error);
      }
    }
  } else {
    console.warn('⚠️ No Moralis API key found, using CoinGecko');
  }

  // Fallback to CoinGecko
  try {
    const fallbackTokens = await fetchCoinGeckoPrices(chain, undefined, signal);
    setCache(priceCache, chain, fallbackTokens, "coingecko");
    return { tokens: fallbackTokens, source: "coingecko" };
  } catch (error) {
    console.error(`❌ Both Moralis and CoinGecko failed for ${chain}`, error);
    // Return empty array instead of throwing to prevent app crash
    return { tokens: [], source: "coingecko" };
  }
};

export const getTokenPricesByChain = fetchEvmTokenPrices;

const mapTopToken = (token: MoralisTopToken): MarketToken | null => {
  const chain = mapMoralisChainToEvm(token.chain);
  if (!chain) {
    return null;
  }

  return {
    chain,
    network: MARKET_CHAINS[chain].label,
    address: token.token_address,
    name: token.name,
    symbol: token.symbol,
    priceUsd: token.usd_price ?? 0,
    change24h: typeof token.percent_change_24h === "number" ? token.percent_change_24h : null,
  };
};

const fetchCoinGeckoTopTokens = async (
  limit: number,
  signal?: AbortSignal,
): Promise<MarketToken[]> => {
  const query = new URLSearchParams({
    vs_currency: "usd",
    order: "market_cap_desc",
    per_page: String(limit),
    page: "1",
    price_change_percentage: "24h",
  });
  const response = await fetch(`${COINGECKO_BASE_URL}/coins/markets?${query}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`CoinGecko top tokens failed (${response.status})`);
  }
  const data: Array<{
    id: string;
    name: string;
    symbol: string;
    current_price: number;
    price_change_percentage_24h?: number | null;
  }> = await response.json();

  return data.map((item) => ({
    chain: "ethereum",
    network: MARKET_CHAINS.ethereum.label,
    address: item.id,
    name: item.name,
    symbol: item.symbol,
    priceUsd: item.current_price,
    change24h:
      typeof item.price_change_percentage_24h === "number"
        ? item.price_change_percentage_24h
        : null,
  } satisfies MarketToken));
};

export const fetchTopErc20Tokens = async (options?: {
  chain?: Exclude<EvmChain, "all">;
  limit?: number;
  signal?: AbortSignal;
  force?: boolean;
}): Promise<TokenPriceResponse> => {
  const chain = options?.chain;
  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 50);
  const cacheKey = chain ? `${chain}-${limit}` : `global-${limit}`;
  const cached = ensureCached(topTokensCache, cacheKey, CACHE_DURATION_MS);
  if (!options?.force && cached) {
    return { tokens: cached.data, source: cached.source };
  }

  const apiKey = resolveMoralisApiKey();

  if (apiKey) {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (chain) {
        params.set("chain", MARKET_CHAINS[chain].moralisChain);
      }
      const response = await fetch(`${MORALIS_BASE_URL}/market-data/erc20s/top-tokens?${params}`, {
        headers: {
          "X-API-Key": apiKey,
        },
        signal: options?.signal,
      });

      if (!response.ok) {
        throw new Error(`Moralis top tokens request failed (${response.status})`);
      }

      const payload: { result?: MoralisTopToken[] } = await response.json();
      const tokens = (payload.result ?? [])
        .map(mapTopToken)
        .filter((token): token is MarketToken => token !== null)
        .slice(0, limit);

      if (tokens.length > 0) {
        setCache(topTokensCache, cacheKey, tokens, "moralis");
        return { tokens, source: "moralis" };
      }
    } catch (error) {
      console.warn("Moralis top tokens fetch failed", error);
    }
  }

  const fallbackTokens = await fetchCoinGeckoTopTokens(limit, options?.signal);
  setCache(topTokensCache, cacheKey, fallbackTokens, "coingecko");
  return { tokens: fallbackTokens, source: "coingecko" };
};

export const fetchTokenPrice = async (
  address: string,
  chain: Exclude<EvmChain, "all">,
  signal?: AbortSignal,
): Promise<TokenPrice> => {
  const apiKey = resolveMoralisApiKey();
  const lower = address.toLowerCase();
  if (apiKey) {
    try {
      const url = `${MORALIS_BASE_URL}/erc20/${lower}/price?chain=${MARKET_CHAINS[chain].moralisChain}`;
      const response = await fetch(url, {
        headers: {
          "X-API-Key": apiKey,
        },
        signal,
      });
      if (!response.ok) {
        throw new Error(`Moralis token price failed (${response.status})`);
      }
      const data: {
        usdPrice?: number;
        usdPrice24hrAgo?: number;
        usdPricePercentChange24h?: number;
        usdPrice_percent_change_24h?: number;
      } = await response.json();
      const price = data.usdPrice ?? 0;
      const change =
        data.usdPricePercentChange24h ??
        data.usdPrice_percent_change_24h ??
        (data.usdPrice24hrAgo && data.usdPrice24hrAgo > 0
          ? ((price - data.usdPrice24hrAgo) / data.usdPrice24hrAgo) * 100
          : null);
      return {
        address: lower,
        chain,
        symbol: TOKEN_DIRECTORY[chain].find((token: TokenConfig) => token.address.toLowerCase() === lower)?.symbol ?? "",
        name: TOKEN_DIRECTORY[chain].find((token: TokenConfig) => token.address.toLowerCase() === lower)?.name ?? address,
        priceUsd: price,
        change24h: typeof change === "number" ? change : null,
        source: "moralis",
      } satisfies TokenPrice;
    } catch (error) {
      console.warn("Moralis token price fetch failed", error);
    }
  }

  const query = new URLSearchParams({
    contract_addresses: lower,
    vs_currencies: "usd",
    include_24hr_change: "true",
  });
  const response = await fetch(
    `${COINGECKO_BASE_URL}/simple/token_price/${MARKET_CHAINS[chain].coingeckoPlatform}?${query}`,
    { headers: { Accept: "application/json" }, signal },
  );
  if (!response.ok) {
    throw new Error("Unable to fetch token price from fallback");
  }
  const payload: Record<
    string,
    {
      usd?: number;
      usd_24h_change?: number;
    }
  > = await response.json();
  const entry = payload[lower];
  return {
    address: lower,
    chain,
    symbol: TOKEN_DIRECTORY[chain].find((token: TokenConfig) => token.address.toLowerCase() === lower)?.symbol ?? "",
    name: TOKEN_DIRECTORY[chain].find((token: TokenConfig) => token.address.toLowerCase() === lower)?.name ?? address,
    priceUsd: entry?.usd ?? 0,
    change24h: typeof entry?.usd_24h_change === "number" ? entry.usd_24h_change : null,
    source: "coingecko",
  } satisfies TokenPrice;
};

const fetchCoinGeckoDetail = async (id: string, signal?: AbortSignal): Promise<CoinFullInfo | null> => {
  if (!id) {
    return null;
  }

  const query = new URLSearchParams({
    localization: "false",
    tickers: "false",
    market_data: "true",
    community_data: "false",
    developer_data: "false",
    sparkline: "false",
  });

  const response = await fetch(
    `${COINGECKO_BASE_URL}/coins/${encodeURIComponent(id)}?${query.toString()}`,
    {
      headers: { Accept: "application/json" },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(`CoinGecko detail request failed (${response.status})`);
  }

  return (await response.json()) as CoinFullInfo;
};

export const fetchTokenMarketDetail = async (
  params: { chain: Exclude<EvmChain, "all">; address: string; signal?: AbortSignal },
): Promise<TokenMarketDetail> => {
  const { chain, address, signal } = params;
  const config = findTokenConfig(chain, address);
  if (!config) {
    throw new Error("Token is not registered for the selected chain.");
  }

  const baseToken: MarketToken = {
    chain,
    network: MARKET_CHAINS[chain].label,
    address: config.address,
    name: config.name,
    symbol: config.symbol,
    priceUsd: 0,
    change24h: null,
  };

  let priceSource: MarketSource = "coingecko";
  let price: number | null = null;
  let change: number | null = null;

  const apiKey = resolveMoralisApiKey();

  if (apiKey) {
    try {
      const parsed = await requestMoralisTokenPrice(config, apiKey, signal);

      if (parsed) {
        price = parsed.priceUsd;
        change = parsed.change24h;
        priceSource = "moralis";
      }
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      console.warn(`Moralis detail fetch failed for ${config.symbol}`, error);
    }
  }

  if (price === null) {
    try {
      const [fallback] = await fetchCoinGeckoPrices(chain, [config], signal);
      if (fallback) {
        price = fallback.priceUsd;
        change = fallback.change24h;
        priceSource = "coingecko";
      }
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      console.warn(`CoinGecko fallback failed for ${config.symbol}`, error);
    }
  }

  let detail: CoinFullInfo | null = null;
  try {
    detail = await fetchCoinGeckoDetail(config.coingeckoId, signal);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    console.warn(`CoinGecko detail fetch failed for ${config.symbol}`, error);
  }

  const marketData = detail?.market_data;
  const lastUpdated =
    typeof marketData?.last_updated === "string"
      ? marketData?.last_updated
      : typeof detail?.last_updated === "string"
        ? detail?.last_updated
        : null;

  return {
    token: {
      ...baseToken,
      priceUsd: price ?? 0,
      change24h: change ?? null,
    },
    marketCapUsd: marketData?.market_cap?.usd ?? null,
    volume24hUsd: marketData?.total_volume?.usd ?? null,
    high24h: marketData?.high_24h?.usd ?? null,
    low24h: marketData?.low_24h?.usd ?? null,
    description: sanitizeRichText(detail?.description?.en ?? null),
    image: detail?.image?.large ?? detail?.image?.small ?? null,
    lastUpdated,
    source: priceSource,
  } satisfies TokenMarketDetail;
};

export const searchTokens = async (
  query: string,
  options?: { limit?: number; signal?: AbortSignal; force?: boolean },
): Promise<TokenSearchResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const limit = Math.min(Math.max(options?.limit ?? 10, 1), 50);
  const key = `${trimmed.toLowerCase()}-${limit}`;
  const cached = ensureCached(searchCache, key, SEARCH_CACHE_DURATION_MS);
  if (!options?.force && cached) {
    return cached.data;
  }

  const apiKey = resolveMoralisApiKey();
  if (apiKey) {
    try {
      const params = new URLSearchParams({ query: trimmed, limit: String(limit) });
      const response = await fetch(`${MORALIS_BASE_URL}/tokens/search?${params}`, {
        headers: {
          "X-API-Key": apiKey,
        },
        signal: options?.signal,
      });
      if (!response.ok) {
        throw new Error(`Moralis token search failed (${response.status})`);
      }
      const payload: { result?: MoralisSearchToken[] } = await response.json();
      const results = (payload.result ?? []).reduce<TokenSearchResult[]>((accumulator, item) => {
        const chain = mapMoralisChainToEvm(item.chain);
        if (!chain) {
          return accumulator;
        }
        accumulator.push({
          address: item.token_address,
          chain,
          symbol: item.symbol,
          name: item.name,
          logo: item.logo ?? null,
        });
        return accumulator;
      }, []);

      const sliced = results.slice(0, limit);
      setCache(searchCache, key, sliced, "moralis");
      return sliced;
    } catch (error) {
      console.warn("Moralis token search failed", error);
    }
  }

  // Fallback: filter known directory and rely on CoinGecko search
  const directoryMatches = Object.values(TOKEN_DIRECTORY)
    .flat()
    .filter((token) =>
      token.name.toLowerCase().includes(trimmed.toLowerCase()) ||
      token.symbol.toLowerCase().includes(trimmed.toLowerCase()),
    )
    .slice(0, limit)
    .map((token) => ({
      address: token.address,
      chain: token.chain,
      symbol: token.symbol,
      name: token.name,
      logo: null,
    }));

  if (directoryMatches.length >= limit) {
    setCache(searchCache, key, directoryMatches, "coingecko");
    return directoryMatches;
  }

  try {
    const params = new URLSearchParams({ query: trimmed });
    const response = await fetch(`${COINGECKO_BASE_URL}/search?${params}`, {
      headers: { Accept: "application/json" },
      signal: options?.signal,
    });
    if (!response.ok) {
      throw new Error("CoinGecko search failed");
    }
    const payload: {
      coins?: Array<{ id: string; name: string; symbol: string }>;
    } = await response.json();
    const combined = directoryMatches.concat(
      (payload.coins ?? [])
        .filter((coin) => coin.id && coin.symbol && coin.name)
        .slice(0, limit)
        .map((coin) => ({
          address: coin.id,
          chain: "ethereum" as Exclude<EvmChain, "all">,
          symbol: coin.symbol,
          name: coin.name,
          logo: null,
        })),
    );
    setCache(searchCache, key, combined.slice(0, limit), "coingecko");
    return combined.slice(0, limit);
  } catch (error) {
    console.warn("CoinGecko search failed", error);
    setCache(searchCache, key, directoryMatches, "coingecko");
    return directoryMatches;
  }
};

const curatedDiscoveryFallback: DiscoveryToken[] = [
  {
    address: "0xa2327a938febf5fec13bacfb16ae10ecbc4cbdcf",
    chain: "ethereum",
    symbol: "SNX",
    name: "Synthetix",
    description: "Decentralised derivatives liquidity protocol.",
    tags: ["derivatives", "defi"],
    url: "https://synthetix.io",
    logo: "https://assets.coingecko.com/coins/images/3406/large/SNX.png",
  },
  {
    address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    chain: "ethereum",
    symbol: "UNI",
    name: "Uniswap",
    description: "Leading AMM for swapping ERC20 tokens.",
    tags: ["dex", "defi"],
    url: "https://app.uniswap.org",
    logo: "https://assets.coingecko.com/coins/images/12504/large/uniswap-uni.png",
  },
];

export const fetchDiscoveryTokens = async (options?: {
  limit?: number;
  signal?: AbortSignal;
  force?: boolean;
}): Promise<{ tokens: DiscoveryToken[]; source: MarketSource }> => {
  const limit = Math.min(Math.max(options?.limit ?? 12, 1), 50);
  const cached = ensureCached(discoveryCache, `discovery-${limit}`, CACHE_DURATION_MS);
  if (!options?.force && cached) {
    return { tokens: cached.data, source: cached.source };
  }

  const apiKey = resolveMoralisApiKey();
  if (apiKey) {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      const response = await fetch(`${MORALIS_BASE_URL}/discovery/tokens?${params}`, {
        headers: { "X-API-Key": apiKey },
        signal: options?.signal,
      });
      if (!response.ok) {
        throw new Error(`Moralis discovery tokens failed (${response.status})`);
      }
      const payload: { result?: MoralisDiscoveryToken[] } = await response.json();
      const tokens = (payload.result ?? []).reduce<DiscoveryToken[]>((accumulator, token) => {
        const chain = mapMoralisChainToEvm(token.chain);
        if (!chain) {
          return accumulator;
        }
        accumulator.push({
          address: token.token_address,
          chain,
          symbol: token.symbol,
          name: token.name,
          description: token.description,
          tags: token.tags,
          url: token.project_url,
          logo: token.logo ?? null,
        });
        return accumulator;
      }, []);
      const sliced = tokens.slice(0, limit);
      if (sliced.length > 0) {
        setCache(discoveryCache, `discovery-${limit}`, sliced, "moralis");
        return { tokens: sliced, source: "moralis" };
      }
    } catch (error) {
      console.warn("Moralis discovery fetch failed", error);
    }
  }

  setCache(discoveryCache, `discovery-${limit}`, curatedDiscoveryFallback.slice(0, limit), "coingecko");
  return { tokens: curatedDiscoveryFallback.slice(0, limit), source: "coingecko" };
};
