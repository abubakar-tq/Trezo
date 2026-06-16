import axios from 'axios';
import { storageService, StorageKeys } from './StorageService';

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
const COINGECKO_KEY = process.env.EXPO_PUBLIC_COINGECKO_API_KEY;

export interface MarketAsset {
  id: string;
  rank: string;
  symbol: string;
  name: string;
  supply: string;
  maxSupply: string | null;
  marketCapUsd: string;
  volumeUsd24Hr: string;
  priceUsd: string;
  changePercent24Hr: string;
  vwap24Hr: string;
}

export interface HistoryData {
  priceUsd: string;
  time: number;
}

class MarketService {
  private api = axios.create({
    baseURL: COINGECKO_BASE_URL,
    headers: { ...(COINGECKO_KEY ? { "x-cg-demo-api-key": COINGECKO_KEY } : {}) },
    timeout: 20000,
  });

  async getTopAssets(limit = 20): Promise<MarketAsset[]> {
    // Check Cache First
    const cached = storageService.get<MarketAsset[]>(StorageKeys.TOP_ASSETS);
    
    // We start the fetch in background (or foreground if no cache)
    const fetchTask = async () => {
      try {
        console.log("[MarketService] Fetching top assets from CoinGecko...");
        const response = await this.api.get(`/coins/markets`, {
          params: { vs_currency: "usd", order: "market_cap_desc", per_page: limit, page: 1 },
        });
        const assets: MarketAsset[] = response.data.map((c: any) => ({
          id: c.id,
          rank: String(c.market_cap_rank ?? "0"),
          symbol: String(c.symbol ?? "").toUpperCase(),
          name: c.name,
          supply: String(c.circulating_supply ?? "0"),
          maxSupply: c.max_supply != null ? String(c.max_supply) : null,
          marketCapUsd: String(c.market_cap ?? "0"),
          volumeUsd24Hr: String(c.total_volume ?? "0"),
          priceUsd: String(c.current_price ?? "0"),
          changePercent24Hr: String(c.price_change_percentage_24h ?? "0"),
          vwap24Hr: String(c.current_price ?? "0"),
        }));
        storageService.set(StorageKeys.TOP_ASSETS, assets);
        return assets;
      } catch (error: any) {
        const isNetworkError = error.message === "Network Error" || !error.response;
        console.log(`[MarketService] CoinGecko ${isNetworkError ? "Network" : "API"} failure. Activating Binance Fallback.`);
        
        try {
          const { binanceService } = require('./BinanceService');
          const binanceStats = await binanceService.getGlobalMarketStats();
          const assets = binanceStats.map((t: any) => ({
            id: t.symbol.replace('USDT', '').toLowerCase(),
            rank: '0',
            symbol: t.symbol.replace('USDT', ''),
            name: t.symbol.replace('USDT', ''),
            supply: '0',
            maxSupply: null,
            marketCapUsd: '0',
            volumeUsd24Hr: t.quoteVolume,
            priceUsd: t.lastPrice,
            changePercent24Hr: t.priceChangePercent,
            vwap24Hr: t.weightedAvgPrice
          }));
          storageService.set(StorageKeys.TOP_ASSETS, assets);
          return assets;
        } catch (fallbackError) {
          console.error('[MarketService] All market providers failed:', fallbackError);
          return [];
        }
      }
    };

    if (cached) {
      // Refresh in background without blocking
      fetchTask();
      return cached.slice(0, limit);
    }

    return await fetchTask();
  }

  async getAssetHistory(id: string, interval: string = 'h1'): Promise<HistoryData[]> {
    const cacheKey = StorageKeys.ASSET_HISTORY(id, interval);
    const cached = storageService.get<HistoryData[]>(cacheKey);

    const fetchTask = async () => {
      try {
        console.log(`[MarketService] Fetching history for ${id}...`);
        const response = await this.api.get(`/assets/${id}/history`, {
          params: { interval }
        });
        const history = response.data.data;
        storageService.set(cacheKey, history);
        return history;
      } catch (error: any) {
        console.warn(`[MarketService] Failed to fetch history for ${id} from primary source. Attempting Binance fallback.`);

        try {
          const { binanceService } = require('./BinanceService');
          const idToSymbol: Record<string, string> = {
            'bitcoin': 'BTC',
            'ethereum': 'ETH',
            'solana': 'SOL',
            'binance-coin': 'BNB',
            'ripple': 'XRP',
            'cardano': 'ADA',
            'dogecoin': 'DOGE',
            'polkadot': 'DOT',
            'tron': 'TRX',
            'polygon': 'MATIC',
            'bittensor': 'TAO',
            'chainlink': 'LINK',
            'tether': 'USDT',
            'usd-coin': 'USDC',
            'staked-ether': 'ETH',
            'dai': 'DAI',
            'wrapped-bitcoin': 'BTC',
            'litecoin': 'LTC',
            'shiba-inu': 'SHIB',
            'bitcoin-cash': 'BCH'
          };
          const symbol = idToSymbol[id] || id.toUpperCase();
          const bInterval = interval === 'm15' ? '15m' : interval === 'h2' ? '2h' : interval === 'h12' ? '12h' : interval === 'd1' ? '1d' : '1h';

          console.log(`[MarketService] Attempting Binance klines fallback for ${symbol}...`);
          const klines = await binanceService.getKlines(symbol, bInterval, 50);

          if (klines && klines.length > 0) {
            const history = klines.map((k: any) => ({
              priceUsd: k.close,
              time: k.closeTime
            }));
            storageService.set(cacheKey, history);
            return history;
          }
        } catch (e) {
          console.error('[MarketService] History fallback failed:', e);
        }
        return [];
      }
    };

    if (cached) {
      fetchTask(); // Background refresh
      return cached;
    }

    return await fetchTask();
  }

  async getAssetDetails(id: string): Promise<MarketAsset | null> {
    try {
      const response = await this.api.get(`/assets/${id}`);
      return response.data.data;
    } catch (error: any) {
      console.log(`[MarketService] Failed to fetch details for ${id}. Attempting Binance detail fetch.`);
      try {
        const { binanceService } = require('./BinanceService');
        const idToSymbol: Record<string, string> = {
          'bitcoin': 'BTC',
          'ethereum': 'ETH',
          'binance-coin': 'BNB',
          'solana': 'SOL',
          'ripple': 'XRP',
          'cardano': 'ADA',
          'dogecoin': 'DOGE',
          'polkadot': 'DOT',
          'tron': 'TRX',
          'polygon': 'MATIC',
          'bittensor': 'TAO',
          'chainlink': 'LINK',
          'tether': 'USDT',
          'usd-coin': 'USDC'
        };
        const symbol = idToSymbol[id] || id.toUpperCase();
        const ticker = await binanceService.getTicker24h(symbol);
        if (ticker) {
          return {
            id,
            rank: '0',
            symbol,
            name: symbol,
            supply: '0',
            maxSupply: null,
            marketCapUsd: '0',
            volumeUsd24Hr: ticker.quoteVolume,
            priceUsd: ticker.lastPrice,
            changePercent24Hr: ticker.priceChangePercent,
            vwap24Hr: ticker.weightedAvgPrice
          };
        }
      } catch (e) {
        console.error('[MarketService] Detail fallback failed:', e);
      }
      return null;
    }
  }

  /**
   * Fetches market data for a specific set of symbols (via Binance), mapped to
   * MarketAsset and sorted by 24h volume. Powers the Discover category views.
   */
  async getAssetsBySymbols(symbols: string[]): Promise<MarketAsset[]> {
    try {
      const { binanceService } = require('./BinanceService');
      const tickers = await binanceService.getTickersForSymbols(symbols);
      return tickers
        .map((t: any) => ({
          id: t.symbol.replace('USDT', '').toLowerCase(),
          rank: '0',
          symbol: t.symbol.replace('USDT', ''),
          name: t.symbol.replace('USDT', ''),
          supply: '0',
          maxSupply: null,
          marketCapUsd: '0',
          volumeUsd24Hr: t.quoteVolume,
          priceUsd: t.lastPrice,
          changePercent24Hr: t.priceChangePercent,
          vwap24Hr: t.weightedAvgPrice,
        }))
        .sort((a: MarketAsset, b: MarketAsset) => parseFloat(b.volumeUsd24Hr) - parseFloat(a.volumeUsd24Hr));
    } catch (error) {
      console.error('[MarketService] getAssetsBySymbols failed:', error);
      return [];
    }
  }

  /**
   * Search assets by name/symbol using CoinCap v2 /assets?search=<query>.
   * Returns up to `limit` results mapped to the standard MarketAsset shape.
   */
  async searchAssets(query: string, limit = 20): Promise<MarketAsset[]> {
    if (!query.trim()) return [];
    try {
      const response = await this.api.get(`/assets`, {
        params: { search: query.trim(), limit },
      });
      return response.data.data as MarketAsset[];
    } catch (error) {
      console.warn('[MarketService] searchAssets failed:', error);
      return [];
    }
  }

  /**
   * Helper to convert interval labels to CoinCap intervals
   */
  getIntervalForLabel(label: string): string {
    switch (label) {
      case '1D': return 'm15'; // 15 min intervals for 1 day
      case '1W': return 'h2';  // 2 hour intervals for 1 week
      case '1M': return 'h12'; // 12 hour intervals for 1 month
      case '1Y': return 'd1';  // 1 day intervals for 1 year
      default: return 'h1';
    }
  }
}

export const marketService = new MarketService();
