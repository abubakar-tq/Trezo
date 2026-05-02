import { useQuery } from "@tanstack/react-query";
import { MoralisService, type MoralisToken } from "../../integration/moralis/MoralisService";
import { formatUnits } from "ethers";
import { useMemo } from "react";

export interface WalletDataState {
  ethBalance: number;
  tokens: MoralisToken[];
  totalBalanceUSD: number;
  totalChange24h: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export const useWalletData = (address?: string, chain: string = "0x1"): WalletDataState => {
  // UI/UX DEVELOPMENT MODE: Using realistic mock data to ensure layouts look premium
  // and predictable while iterating on designs.
  
  const { ethBalance, tokens, totalBalanceUSD } = useMemo(() => {
    const mockTokens: any[] = [
      { 
        symbol: 'ETH', 
        name: 'Ethereum', 
        balance: '1.25', 
        decimals: 18, 
        usd_price: 2500,
        usd_value: 3125.00, 
        native_token: true,
        logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
      },
      { 
        symbol: 'USDC', 
        name: 'USD Coin', 
        balance: '120.5', 
        decimals: 6, 
        usd_price: 1,
        usd_value: 120.50,
        logo: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png'
      },
      { 
        symbol: 'LINK', 
        name: 'Chainlink', 
        balance: '14.2', 
        decimals: 18, 
        usd_price: 20.34,
        usd_value: 288.82,
        logo: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png'
      },
      { 
        symbol: 'USDT', 
        name: 'Tether', 
        balance: '45.0', 
        decimals: 6, 
        usd_price: 1,
        usd_value: 45.00,
        logo: 'https://assets.coingecko.com/coins/images/325/small/tether.png'
      },
      { 
        symbol: 'MATIC', 
        name: 'Polygon', 
        balance: '150.00', 
        decimals: 18, 
        usd_price: 0.60,
        usd_value: 90.00,
        logo: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png'
      }
    ];

    const totalBalanceUSD = mockTokens.reduce((sum, t) => sum + t.usd_value, 0);
    const ethBalance = 1.25;

    return { ethBalance, tokens: mockTokens, totalBalanceUSD };
  }, []);

  return {
    ethBalance,
    tokens,
    totalBalanceUSD,
    totalChange24h: 2.45, // Adding a positive change for "WOW" factor
    isLoading: false,
    isError: false,
    error: null,
    refetch: () => console.log("Refetch triggered in mock mode"),
  };
};
