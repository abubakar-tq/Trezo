/**
 * Portfolio Service
 * 
 * Manages portfolio data by reading from blockchain and price APIs
 * Phase 2: Real blockchain data integration
 */

import { getRpcUrl } from '@/src/core/network/chain';
import { createPublicClient, formatEther, http } from 'viem';
import { anvil } from 'viem/chains';

export interface TokenBalance {
  symbol: string;
  name: string;
  price: number;
  amount: number;
  value: number;
  address: string;
  change24h?: number;
}

export interface PortfolioData {
  totalValue: number;
  tokens: TokenBalance[];
  change24h: number;
  costBasis: number;
  unrealizedPnL: number;
}

export class PortfolioService {
  /**
   * Get ETH balance for an address
   */
  static async getETHBalance(address: string): Promise<number> {
    try {
      const publicClient = createPublicClient({
        chain: anvil,
        transport: http(getRpcUrl()),
      });
      
      const balance = await publicClient.getBalance({ 
        address: address as `0x${string}` 
      });
      
      return Number(formatEther(balance));
    } catch (error) {
      console.error('Failed to get ETH balance:', error);
      return 0;
    }
  }
  
  /**
   * Get current ETH price from CoinGecko (free API)
   */
  static async getETHPrice(): Promise<number> {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch price');
      }
      
      const data = await response.json();
      return data.ethereum.usd;
    } catch (error) {
      console.error('Failed to get ETH price:', error);
      // Fallback to approximate price
      return 3245.32;
    }
  }
  
  /**
   * Get complete portfolio data for an address
   */
  static async getPortfolio(address: string): Promise<PortfolioData> {
    try {
      // Get real balance from blockchain
      const ethBalance = await this.getETHBalance(address);
      
      // Get current price
      const ethPrice = await this.getETHPrice();
      
      // Calculate value
      const ethValue = ethBalance * ethPrice;
      
      // For now, assume cost basis = 0 (all profit from test funding)
      const costBasis = 0;
      const unrealizedPnL = ethValue - costBasis;
      
      return {
        totalValue: ethValue,
        tokens: [
          {
            symbol: 'ETH',
            name: 'Ethereum',
            price: ethPrice,
            amount: ethBalance,
            value: ethValue,
            address: 'native',
          }
        ],
        change24h: 0, // Would need historical data
        costBasis,
        unrealizedPnL,
      };
    } catch (error) {
      console.error('Failed to get portfolio:', error);
      
      // Return empty portfolio on error
      return {
        totalValue: 0,
        tokens: [],
        change24h: 0,
        costBasis: 0,
        unrealizedPnL: 0,
      };
    }
  }
  
  /**
   * Format USD value for display
   */
  static formatUSD(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  
  /**
   * Format token amount for display
   */
  static formatAmount(amount: number, decimals: number = 4): string {
    return amount.toFixed(decimals);
  }
}
