/**
 * market.ts — Extension data layer: market feed (CoinGecko + Binance fallback)
 *
 * Runs in both popup and service worker. Uses only `fetch` (no axios/RN deps).
 * In-memory cache: 60 s TTL.
 *
 * CoinGecko `/coins/markets` returns price + 24h change + market-cap rank +
 * a real logo URL (`image`) + a 7-day sparkline in a single call, so it powers
 * the Market tab, token icons, and detail charts from one source.
 * (CoinCap v2 was sunset in 2025 — its endpoints now 404, which flooded the
 * console; this replaces it.)
 */

export interface MarketAsset {
  id: string;            // CoinGecko id, e.g. "ethereum" (used for history + links)
  symbol: string;        // UPPER-CASE, e.g. "ETH"
  name: string;
  priceUsd: number;
  change24h: number;
  rank: number;
  iconUrl?: string;      // real logo URL (CoinGecko `image`)
  sparkline?: number[];  // 7-day price points (CoinGecko `sparkline_in_7d`)
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

let _cache: MarketAsset[] | null = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000;
// In-flight dedup: concurrent callers share one network request — but only when the
// in-flight request is for at least as many assets as the new caller needs, so a small
// getTopAssets(20) never starves a larger getTopAssets(200) (which would truncate the
// price index used by balances).
let _inflight: Promise<MarketAsset[]> | null = null;
let _inflightLimit = 0;

// ─── CoinGecko ─────────────────────────────────────────────────────────────────

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

async function fetchFromCoinGecko(limit: number): Promise<MarketAsset[]> {
  const perPage = Math.min(Math.max(limit, 1), 250);
  const url =
    `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc` +
    `&per_page=${perPage}&page=1&price_change_percentage=24h&sparkline=true`;

  const headers: Record<string, string> = {};
  // Optional demo key lifts the rate limit; works fine unauthenticated too.
  const key: string =
    (import.meta.env as Record<string, string | undefined>).VITE_COINGECKO_API_KEY ?? "";
  if (key) headers["x-cg-demo-api-key"] = key;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);

  const json = (await res.json()) as Array<{
    id: string;
    symbol: string;
    name: string;
    image: string;
    current_price: number | null;
    price_change_percentage_24h: number | null;
    market_cap_rank: number | null;
    sparkline_in_7d?: { price?: number[] };
  }>;

  return (json ?? []).map((a, i) => ({
    id: a.id,
    symbol: (a.symbol || "").toUpperCase(),
    name: a.name,
    priceUsd: a.current_price ?? 0,
    change24h: a.price_change_percentage_24h ?? 0,
    rank: a.market_cap_rank ?? i + 1,
    iconUrl: a.image || undefined,
    sparkline: a.sparkline_in_7d?.price?.length ? a.sparkline_in_7d.price : undefined,
  }));
}

// ─── Binance fallback ─────────────────────────────────────────────────────────

// Essential subset of top symbols to get pricing coverage if CoinGecko is rate-limited.
// (No icons/sparkline — fallback only.)
const BINANCE_TOP_SYMBOLS = [
  "BTC", "ETH", "USDC", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "SHIB",
  "DOT", "MATIC", "LINK", "UNI", "ATOM", "LTC", "BCH", "ALGO", "VET", "ICP",
];

// Map Binance symbols → real CoinGecko ids so a detail-chart lookup on a fallback
// asset resolves correctly instead of 404-ing on a bogus id.
const BINANCE_ID_MAP: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", USDC: "usd-coin", SOL: "solana", BNB: "binancecoin",
  XRP: "ripple", DOGE: "dogecoin", ADA: "cardano", AVAX: "avalanche-2", SHIB: "shiba-inu",
  DOT: "polkadot", MATIC: "matic-network", LINK: "chainlink", UNI: "uniswap", ATOM: "cosmos",
  LTC: "litecoin", BCH: "bitcoin-cash", ALGO: "algorand", VET: "vechain", ICP: "internet-computer",
};

async function fetchFromBinance(limit: number): Promise<MarketAsset[]> {
  const symbols = BINANCE_TOP_SYMBOLS.slice(0, Math.max(limit, BINANCE_TOP_SYMBOLS.length));
  const pairs = symbols.map((s) => `"${s}USDT"`).join(",");
  const encoded = encodeURIComponent(`[${pairs}]`);

  const res = await fetch(
    `https://api.binance.com/api/v3/ticker/24hr?symbols=${encoded}`,
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);

  const tickers = (await res.json()) as Array<{
    symbol: string;
    lastPrice: string;
    priceChangePercent: string;
    quoteVolume: string;
  }>;

  return tickers
    .map((t, i) => {
      const sym = t.symbol.replace("USDT", "");
      return {
        id: BINANCE_ID_MAP[sym] ?? sym.toLowerCase(),
        symbol: sym,
        name: sym,
        priceUsd: parseFloat(t.lastPrice) || 0,
        change24h: parseFloat(t.priceChangePercent) || 0,
        rank: i + 1,
      } as MarketAsset;
    })
    .sort((a, b) => a.rank - b.rank); // rank ascending (rank 1 = most known)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch top `limit` market assets sorted by market-cap rank (CoinGecko).
 * Falls back to Binance top symbols on CoinGecko failure (e.g. rate limit).
 * In-memory cache with 60 s TTL; concurrent callers share one in-flight request.
 * Never throws — returns [] (or stale cache) on total failure.
 */
export async function getTopAssets(limit = 20): Promise<MarketAsset[]> {
  if (_cache && Date.now() < _cacheExpiresAt && _cache.length >= limit) {
    return _cache.slice(0, limit);
  }
  // Piggyback on an in-flight fetch only if it covers what we need.
  if (_inflight && _inflightLimit >= limit) {
    return _inflight.then((a) => a.slice(0, limit));
  }

  const p = (async (): Promise<MarketAsset[]> => {
    let assets: MarketAsset[] = [];
    try {
      assets = await fetchFromCoinGecko(limit);
    } catch {
      try {
        assets = await fetchFromBinance(limit);
      } catch {
        return _cache ?? []; // all providers failed — degrade to stale cache
      }
    }
    if (assets.length > 0) {
      _cache = assets;
      _cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    }
    return assets;
  })();

  _inflight = p;
  _inflightLimit = limit;
  try {
    const assets = await p;
    return assets.slice(0, limit);
  } finally {
    // Only clear if we're still the current in-flight request (a larger concurrent
    // caller may have replaced us).
    if (_inflight === p) { _inflight = null; _inflightLimit = 0; }
  }
}

/** Build a lookup map from UPPER-CASE symbol → MarketAsset. */
export function buildPriceIndex(assets: MarketAsset[]): Map<string, MarketAsset> {
  const m = new Map<string, MarketAsset>();
  for (const a of assets) {
    m.set(a.symbol.toUpperCase(), a);
  }
  return m;
}
