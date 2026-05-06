import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";

import { PortfolioService, type TokenBalance } from "@/src/features/portfolio/services/PortfolioService";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";

export interface MoralisToken {
  symbol: string;
  name: string;
  balance: string;
  balance_formatted?: string;
  decimals: number;
  usd_price: number | null;
  usd_value: number | null;
  native_token?: boolean;
  logo?: string;
  token_address?: string;
}

export interface WalletDataState {
  ethBalance: number;
  tokens: MoralisToken[];
  totalBalanceUSD: number;
  totalChange24h: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  missingPrices: string[];
  refetch: () => void;
}

const POLL_MS = 10_000;

const toMoralisToken = (t: TokenBalance): MoralisToken => ({
  symbol: t.symbol,
  name: t.name,
  balance: t.amount.toString(),
  balance_formatted: t.amount.toFixed(6),
  decimals: t.decimals,
  usd_price: t.price,
  usd_value: t.value,
  native_token: t.address === "native",
  token_address: t.address === "native" ? undefined : (t.address as string),
});

export const useWalletData = (address?: string, _chain: string = "0x1"): WalletDataState => {
  const aaAccount = useWalletStore((s) => s.aaAccount);
  const activeChainId = useWalletStore((s) => s.activeChainId);
  const chainId: SupportedChainId =
    (aaAccount?.chainId as SupportedChainId | undefined) ??
    (activeChainId as SupportedChainId | undefined) ??
    DEFAULT_CHAIN_ID;

  const [tokens, setTokens] = useState<MoralisToken[]>([]);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [missingPrices, setMissingPrices] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (!address) {
      setTokens([]);
      setTotalUsd(0);
      setMissingPrices([]);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const portfolio = await PortfolioService.getPortfolio(address as Address, chainId);
      setTokens(portfolio.tokens.map(toMoralisToken));
      setTotalUsd(portfolio.totalValue);
      setMissingPrices(portfolio.missingPrices);
    } catch (e) {
      console.warn("[useWalletData] fetch failed:", e);
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId]);

  useEffect(() => {
    fetchPortfolio();
    pollRef.current = setInterval(fetchPortfolio, POLL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchPortfolio]);

  const ethBalance = useMemo(() => {
    const native = tokens.find((t) => t.native_token);
    return native ? parseFloat(native.balance) : 0;
  }, [tokens]);

  return {
    ethBalance,
    tokens,
    totalBalanceUSD: totalUsd,
    totalChange24h: 0,
    isLoading,
    isError: Boolean(error),
    error,
    missingPrices,
    refetch: fetchPortfolio,
  };
};
