import { useState, useEffect, useMemo } from 'react';
import { marketService } from '../../services/MarketService';

const SYMBOL_TO_ID: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binance-coin',
  XRP: 'ripple', ADA: 'cardano', AVAX: 'avalanche', DOT: 'polkadot',
  LINK: 'chainlink', MATIC: 'polygon', POL: 'polygon', OP: 'optimism',
  ARB: 'arbitrum', USDC: 'usd-coin', USDT: 'tether', DAI: 'multi-collateral-dai',
  TAO: 'bittensor', DOGE: 'dogecoin', LTC: 'litecoin', SHIB: 'shiba-inu',
};

function toId(symbol: string, name: string): string {
  return SYMBOL_TO_ID[symbol.toUpperCase()] ?? name.toLowerCase().replace(/\s+/g, '-');
}

function periodToInterval(period: string): string {
  switch (period) {
    case '1D': return 'm15';
    case '1W': return 'h2';
    case '1M': return 'h12';
    case '1Y': return 'd1';
    case 'ALL': return 'd1';
    default: return 'h2';
  }
}

interface HeldToken {
  symbol: string;
  name: string;
  amount: number;
}

interface PortfolioHistoryResult {
  /** Portfolio USD value at each time step */
  history: number[];
  loading: boolean;
  /** % change from first to last point, or null if not enough data */
  periodChange: number | null;
  /** USD delta from first to last point, or null */
  periodDelta: number | null;
}

export function usePortfolioHistory(tokens: HeldToken[], period: string): PortfolioHistoryResult {
  const [history, setHistory] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  // Stable key so the effect doesn't re-run on every reference change
  const stableKey = useMemo(
    () => tokens
      .filter(t => t.amount > 0)
      .map(t => `${t.symbol}:${t.amount}`)
      .sort()
      .join(','),
    [tokens]
  );

  useEffect(() => {
    const relevant = tokens.filter(t => t.amount > 0);
    if (relevant.length === 0) {
      setHistory([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const interval = periodToInterval(period);

    Promise.all(
      relevant.map(t =>
        marketService
          .getAssetHistory(toId(t.symbol, t.name), interval)
          .then(pts => pts.map((p: any) => parseFloat(p?.priceUsd ?? p)).filter(isFinite))
          .catch(() => [] as number[])
      )
    ).then(histories => {
      if (cancelled) return;

      // Drop tokens whose history is empty (API failure / unknown coin)
      const paired = relevant
        .map((t, i) => ({ token: t, hist: histories[i] }))
        .filter(p => p.hist.length >= 2);

      if (paired.length === 0) {
        setHistory([]);
        setLoading(false);
        return;
      }

      const minLen = Math.min(...paired.map(p => p.hist.length));

      // At each time step, sum token.amount × price across all held tokens
      const portfolioHistory = Array.from({ length: minLen }, (_, i) =>
        paired.reduce((total, { token, hist }) => {
          // Proportional index in case lengths differ slightly
          const idx = Math.min(
            Math.round((i / (minLen - 1)) * (hist.length - 1)),
            hist.length - 1
          );
          return total + token.amount * (hist[idx] ?? 0);
        }, 0)
      );

      setHistory(portfolioHistory);
      setLoading(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableKey, period]);

  const periodChange = useMemo(() => {
    if (history.length < 2 || !history[0]) return null;
    return ((history[history.length - 1] - history[0]) / history[0]) * 100;
  }, [history]);

  const periodDelta = useMemo(() => {
    if (history.length < 2) return null;
    return history[history.length - 1] - history[0];
  }, [history]);

  return { history, loading, periodChange, periodDelta };
}
