import axios from 'axios';
import { storageService, StorageKeys } from './StorageService';

const COINCAP_BASE_URL = 'https://api.coincap.io/v2';
const API_KEY = process.env.EXPO_PUBLIC_COINCAP_API_KEY;

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
    baseURL: COINCAP_BASE_URL,
    headers: {
      ...(API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {}),
    },
    timeout: 20000, // Increased timeout to 20s
  });

  async getTopAssets(limit = 20): Promise<MarketAsset[]> {
    // Check Cache First
    const cached = storageService.get<MarketAsset[]>(StorageKeys.TOP_ASSETS);
    
    // We start the fetch in background (or foreground if no cache)
    const fetchTask = async () => {
      try {
        console.log('[MarketService] Attempting to fetch top assets from CoinCap...');
        const response = await this.api.get(`/assets?limit=${limit}`);
        const assets = response.data.data;
        storageService.set(StorageKeys.TOP_ASSETS, assets);
        return assets;
      } catch (error: any) {
        const isNetworkError = error.message === 'Network Error' || !error.response;
        console.log(`[MarketService] CoinCap ${isNetworkError ? 'Network/DNS' : 'API'} failure. Activating Binance Fallback.`);
        
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
      return cached;
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
        const isNetworkError = error.message === 'Network Error' || !error.response;
        console.warn(`[MarketService] Failed to fetch history for ${id} from CoinCap. ${isNetworkError ? 'Network blockage.' : ''}`);
        
        if (isNetworkError) {
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
      const isNetworkError = error.message === 'Network Error' || !error.response;
      if (isNetworkError) {
        console.log(`[MarketService] Network blockage for ${id}. Attempting Binance detail fetch.`);
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
      }
      return null;
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
