import { ethers } from "ethers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRpcUrl } from "../../core/network/chain";

export interface MoralisToken {
  symbol: string;
  name: string;
  balance: string;
  balance_formatted?: string;
  decimals: number;
  usd_price: number;
  usd_value: number;
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
  refetch: () => void;
}

const BALANCE_POLL_MS = 10_000;

export const useWalletData = (address?: string, _chain: string = "0x1"): WalletDataState => {
  const [realEthBalance, setRealEthBalance] = useState<number>(0);
  const [isRealLoading, setIsRealLoading] = useState<boolean>(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRealBalance = useCallback(async () => {
    if (!address) {
      setRealEthBalance(0);
      return;
    }
    try {
      setIsRealLoading(true);
      const rpcUrl = getRpcUrl();
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const raw = await provider.getBalance(address);
      const formatted = parseFloat(ethers.formatEther(raw));
      setRealEthBalance(formatted);
    } catch (e) {
      console.warn("❌ [useWalletData] Failed to fetch balance:", e);
    } finally {
      setIsRealLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchRealBalance();
    pollRef.current = setInterval(fetchRealBalance, BALANCE_POLL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchRealBalance]);

  const { tokens, totalBalanceUSD } = useMemo(() => {
    const ethToken: MoralisToken = {
      symbol: "ETH",
      name: "Ethereum",
      balance: realEthBalance.toString(),
      balance_formatted: realEthBalance.toFixed(6),
      decimals: 18,
      usd_price: 2500,
      usd_value: realEthBalance * 2500,
      native_token: true,
      logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    };

    const list = [ethToken];
    const total = list.reduce((sum, t) => sum + t.usd_value, 0);
    return { tokens: list, totalBalanceUSD: total };
  }, [realEthBalance]);

  return {
    ethBalance: realEthBalance,
    tokens,
    totalBalanceUSD,
    totalChange24h: 0,
    isLoading: isRealLoading,
    isError: false,
    error: null,
    refetch: fetchRealBalance,
  };
};
