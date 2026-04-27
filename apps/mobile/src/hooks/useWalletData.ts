import { useQuery } from "@tanstack/react-query";
import { MoralisService, type MoralisToken } from "../integration/moralis/MoralisService";
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
  // Use user address or demo address
  const walletAddress = address || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";

  const walletQuery = useQuery({
    queryKey: ["walletData", walletAddress, chain],
    queryFn: () => MoralisService.getWalletTokens(walletAddress, chain),
    enabled: !!walletAddress,
    staleTime: 5 * 60 * 1000, 
    gcTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { ethBalance, tokens, totalBalanceUSD } = useMemo(() => {
    const allTokens = walletQuery.data || [];
    
    // Filter out spam/unprofessional tokens and very low value ones
    const tokens = allTokens.filter(t => {
      // 1. Exclude known spam/placeholder names that look unprofessional
      const spamKeywords = ["samsung", "nintendo", "gift", "voucher", "spam", "test"];
      const isSpamName = spamKeywords.some(keyword => 
        t.name?.toLowerCase().includes(keyword) || 
        t.symbol?.toLowerCase().includes(keyword)
      );
      
      if (isSpamName) return false;

      // 2. Filter by value: only show tokens worth more than 0.01 USD 
      // or native tokens even if low balance
      if (t.native_token) return true;
      if (t.usd_value && t.usd_value > 0.01) return true;
      
      return false;
    });
    
    // Find native token
    const nativeToken = allTokens.find(t => t.native_token);
    const ethBalance = nativeToken 
      ? parseFloat(formatUnits(nativeToken.balance, nativeToken.decimals)) 
      : 0;

    // Calculate total USD value with authentic data
    const totalBalanceUSD = allTokens.reduce((sum, token) => {
      // Return the real value without artificial normalization
      return sum + (token.usd_value || 0);
    }, 0);

    return { ethBalance, tokens, totalBalanceUSD };
  }, [walletQuery.data]);

  // For change, we use a 0 default until historical data is integrated to avoid "fake" reporting
  const totalChange24h = 0; 

  return {
    ethBalance,
    tokens,
    totalBalanceUSD,
    totalChange24h,
    isLoading: walletQuery.isLoading,
    isError: walletQuery.isError,
    error: walletQuery.error as Error | null,
    refetch: walletQuery.refetch
  };
};
