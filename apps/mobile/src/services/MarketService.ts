import axios from 'axios';

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
      'Authorization': `Bearer ${API_KEY}`,
      'Accept-Encoding': 'gzip',
    },
    timeout: 15000,
  });

  async getTopAssets(limit = 20): Promise<MarketAsset[]> {
    try {
      const response = await this.api.get(`/assets?limit=${limit}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching top assets:', error);
      return [];
    }
  }

  async getAssetHistory(id: string, interval = 'h1'): Promise<HistoryData[]> {
    try {
      // intervals: m1, m5, m15, m30, h1, h2, h6, h12, d1
      const response = await this.api.get(`/assets/${id}/history?interval=${interval}`);
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching history for ${id}:`, error);
      return [];
    }
  }

  async getAssetDetails(id: string): Promise<MarketAsset | null> {
    try {
      const response = await this.api.get(`/assets/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching details for ${id}:`, error);
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
      default: return 'd1';
    }
  }
}

export const marketService = new MarketService();
