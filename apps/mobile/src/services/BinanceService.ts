import axios from 'axios';

const BINANCE_BASE_URL = process.env.EXPO_PUBLIC_BINANCE_API_URL ? `${process.env.EXPO_PUBLIC_BINANCE_API_URL}/api/v3` : 'https://api.binance.com/api/v3';

export interface BinanceTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

class BinanceService {
  private api = axios.create({
    baseURL: BINANCE_BASE_URL,
    timeout: 20000,
  });

  /**
   * Fetches 24hr ticker statistics for a specific symbol against USDT
   * Used for high-frequency price updates and volatility tracking
   */
  async getTicker24h(symbol: string): Promise<BinanceTicker | null> {
    try {
      const cleanSymbol = symbol.toUpperCase();
      
      // Handle USDT base case: Price is always 1.0 against itself
      if (cleanSymbol === 'USDT' || cleanSymbol === 'USDC') {
        return {
          symbol: `${cleanSymbol}USDT`,
          priceChange: '0',
          priceChangePercent: '0',
          weightedAvgPrice: '1.00',
          prevClosePrice: '1.00',
          lastPrice: '1.00',
          lastQty: '0',
          bidPrice: '1.00',
          bidQty: '0',
          askPrice: '1.00',
          askQty: '0',
          openPrice: '1.00',
          highPrice: '1.00',
          lowPrice: '1.00',
          volume: '0',
          quoteVolume: '0',
          openTime: Date.now() - 86400000,
          closeTime: Date.now(),
          firstId: 0,
          lastId: 0,
          count: 0
        };
      }

      const response = await this.api.get(`/ticker/24hr?symbol=${cleanSymbol}USDT`);
      return response.data;
    } catch (error) {
      // Some assets might not be on Binance or use different pairs
      return null;
    }
  }

  /**
   * Fetches the latest prices for a list of symbols
   * Provides the "Unlimited" public data stream requested for market reporting
   */
  async getLatestPrices(symbols: string[]): Promise<Record<string, string>> {
    try {
      // Binance allows batching symbols in a single request for efficiency
      const symbolString = encodeURIComponent(JSON.stringify(symbols.map(s => `${s.toUpperCase()}USDT`)));
      const response = await this.api.get(`/ticker/price?symbols=${symbolString}`);
      
      const prices: Record<string, string> = {};
      response.data.forEach((item: any) => {
        const symbol = item.symbol.replace('USDT', '');
        prices[symbol] = item.price;
      });
      return prices;
    } catch (error) {
      console.error('Error fetching batch prices from Binance:', error);
      return {};
    }
  }

  /**
   * Fetches global 24h stats for the top trading pairs
   */
  async getGlobalMarketStats(): Promise<BinanceTicker[]> {
    try {
      const response = await this.api.get('/ticker/24hr');
      // Filter for top USDT pairs to keep it relevant and alphanumeric
      const institutionalExclusions = ['DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BONK', 'LUNC', 'USTC'];
      const alphanumericPattern = /^[A-Z0-9]+$/;
      
      return response.data
        .filter((t: any) => 
          t.symbol.endsWith('USDT') && 
          alphanumericPattern.test(t.symbol.replace('USDT', '')) &&
          !institutionalExclusions.some(meme => t.symbol.startsWith(meme))
        )
        .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 30);
    } catch (error) {
      console.error('Error fetching global stats from Binance:', error);
      return [];
    }
  }

  /**
   * Fetches historical candlestick data (klines) for a symbol
   * Used as a fallback when CoinCap historical data is blocked
   */
  async getKlines(symbol: string, interval: string = '1h', limit: number = 50): Promise<any[]> {
    try {
      const cleanSymbol = symbol.toUpperCase();
      
      // Stablecoin Chart Fallback: Return a flat line of 1.0s
      if (cleanSymbol === 'USDT' || cleanSymbol === 'USDC') {
        const now = Date.now();
        return Array.from({ length: limit }, (_, i) => ({
          openTime: now - (limit - i) * 3600000,
          open: '1.00',
          high: '1.01',
          low: '0.99',
          close: '1.00',
          volume: '0',
          closeTime: now - (limit - i - 1) * 3600000
        }));
      }

      // Binance symbol format is SYMBOL + PAIR (e.g., BTCUSDT)
      const response = await this.api.get(`/klines?symbol=${cleanSymbol}USDT&interval=${interval}&limit=${limit}`);
      
      // Binance returns an array of arrays: [openTime, open, high, low, close, volume, closeTime, ...]
      return response.data.map((k: any) => ({
        openTime: k[0],
        open: k[1],
        high: k[2],
        low: k[3],
        close: k[4],
        volume: k[5],
        closeTime: k[6]
      }));
    } catch (error) {
      return [];
    }
  }
}

export const binanceService = new BinanceService();
