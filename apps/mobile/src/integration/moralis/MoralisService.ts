// Accessing environment variables in Expo
// Note: Use EXPO_PUBLIC_ prefix to make variables available in the client bundle
const MORALIS_API_KEY = process.env.EXPO_PUBLIC_MORALIS_API_KEY;

// Simple in-memory cache to limit API usage during development
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

export interface MoralisToken {
  token_address: string;
  name: string;
  symbol: string;
  logo?: string;
  thumbnail?: string;
  decimals: number;
  balance: string;
  balance_formatted?: string;
  usd_price?: number;
  usd_value?: number;
  native_token?: boolean;
  possible_spam?: boolean;
}

export interface MoralisWalletTokensResponse {
  cursor?: string;
  page: number;
  page_size: number;
  result: MoralisToken[];
}

export class MoralisService {
  private static baseUrl = "https://deep-index.moralis.io/api/v2.2";

  private static async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    if (!MORALIS_API_KEY) {
      console.warn("⚠️ MORALIS_API_KEY is not defined. Ensure EXPO_PUBLIC_MORALIS_API_KEY is in your .env");
      throw new Error("Moralis API Key missing.");
    }

    const queryString = new URLSearchParams(params).toString();
    const url = `${this.baseUrl}${endpoint}${queryString ? `?${queryString}` : ""}`;
    
    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`📡 [Moralis] Cache HIT: ${endpoint}`);
      return cached.data;
    }

    try {
      console.log(`🌐 [Moralis] API CALL: ${url}`);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": MORALIS_API_KEY,
          "accept": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`❌ [Moralis] API Error ${response.status}:`, errorData.message || response.statusText);
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      cache.set(url, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error(`❌ [Moralis] Request failed ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Optimized: Get ALL wallet tokens (including native ETH) in a single call.
   * Documentation: https://docs.moralis.io/web3-data-api/evm/reference/get-wallet-token-balances
   */
  static async getWalletTokens(address: string, chain: string = "0x1"): Promise<MoralisToken[]> {
    // This endpoint includes native tokens by default in v2.2
    const data = await this.request<MoralisWalletTokensResponse>(`/wallets/${address}/tokens`, { chain });
    return data.result || [];
  }

  /**
   * Legacy/Fallback: Get native balance only
   */
  static async getNativeBalance(address: string, chain: string = "0x1"): Promise<{ balance: string }> {
    return this.request<{ balance: string }>(`/${address}/balance`, { chain });
  }

  /**
   * Get wallet history (transactions)
   */
  static async getWalletHistory(address: string, chain: string = "0x1") {
    return this.request(`/${address}`, { chain });
  }
}
