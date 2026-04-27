import axios from 'axios';

const BINANCE_BASE_URL = 'https://api.binance.com/api/v3';

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
    timeout: 10000,
  });

  /**
   * Fetches 24hr ticker statistics for a specific symbol against USDT
   * Used for high-frequency price updates and volatility tracking
   */
  async getTicker24h(symbol: string): Promise<BinanceTicker | null> {
    try {
      const response = await this.api.get(`/ticker/24hr?symbol=${symbol.toUpperCase()}USDT`);
      return response.data;
    } catch (error) {
      // Some assets might not be on Binance or use different pairs
      console.warn(`Binance ticker unavailable for ${symbol}`);
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
      // Filter for top USDT pairs to keep it relevant
      return response.data
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 10);
    } catch (error) {
      console.error('Error fetching global stats from Binance:', error);
      return [];
    }
  }
}

export const binanceService = new BinanceService();
