import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { useUserStore } from "@store/useUserStore";
import { useMarketStore } from "@store/useMarketStore";
import { PortfolioService } from "@/src/features/portfolio/services/PortfolioService";
import { MARKET_CHAIN_OPTIONS, fetchTokenMarketDetail, type MarketToken, type TokenMarketDetail, type EvmChain } from "@lib/api/web3Data";

export const useDashboardData = () => {
  const { aaAccount } = useWalletStore();
  const activeChain = useMarketStore((state) => state.activeChain);
  const setActiveChain = useMarketStore((state) => state.setActiveChain);
  const fetchMarketData = useMarketStore((state) => state.fetchMarketData);
  const warmCache = useMarketStore((state) => state.warmCache);
  const loading = useMarketStore((state) => state.loading);
  const error = useMarketStore((state) => state.error);
  const clearError = useMarketStore((state) => state.clearError);
  const searchQuery = useMarketStore((state) => state.searchQuery);
  const setSearchQuery = useMarketStore((state) => state.setSearchQuery);
  const allChains = useMarketStore((state) => state.chains);
  const chainState = allChains[activeChain];

  const [portfolioBalance, setPortfolioBalance] = useState(0);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolio, setPortfolio] = useState<any>(null);

  // Load portfolio balance
  useEffect(() => {
    const loadBalance = async () => {
      if (!aaAccount?.predictedAddress) {
        setPortfolio(null);
        setPortfolioBalance(0);
        return;
      }

      setPortfolioLoading(true);
      try {
        const portfolioData = await PortfolioService.getPortfolio(aaAccount.predictedAddress);
        setPortfolio(portfolioData);
        setPortfolioBalance(portfolioData.totalValue);
      } catch (err) {
        console.error("Failed to load portfolio:", err);
      } finally {
        setPortfolioLoading(false);
      }
    };

    loadBalance();
    const interval = setInterval(loadBalance, 30000);
    return () => clearInterval(interval);
  }, [aaAccount?.predictedAddress]);

  useEffect(() => {
    fetchMarketData({ chain: activeChain }).catch(() => undefined);
  }, [fetchMarketData, activeChain]);

  useEffect(() => {
    warmCache().catch(() => undefined);
  }, [warmCache]);

  const tokens = useMemo(() => {
    if (activeChain === "all") {
      return Object.values(allChains).flatMap((chain) => chain.tokens);
    }
    return chainState?.tokens ?? [];
  }, [activeChain, allChains, chainState]);

  const filteredTokens = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tokens;
    return tokens.filter(
      (token) =>
        token.name.toLowerCase().includes(query) ||
        token.symbol.toLowerCase().includes(query)
    );
  }, [searchQuery, tokens]);

  const handleRefresh = useCallback(() => {
    fetchMarketData({ chain: activeChain, force: true }).catch(() => undefined);
  }, [fetchMarketData, activeChain]);

  return {
    portfolioBalance,
    portfolioLoading,
    portfolio,
    tokens,
    filteredTokens,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    activeChain,
    setActiveChain,
    handleRefresh,
    clearError,
  };
};
