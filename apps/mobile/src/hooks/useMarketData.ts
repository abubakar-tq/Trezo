import { useState, useEffect, useCallback } from 'react';
import { marketService, MarketAsset } from '../services/MarketService';

export function useMarketData(limit = 10) {
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarket = useCallback(async () => {
    setLoading(true);
    try {
      const data = await marketService.getTopAssets(limit);
      setAssets(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch market data');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchMarket();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchMarket, 60000);
    return () => clearInterval(interval);
  }, [fetchMarket]);

  return { assets, loading, error, refresh: fetchMarket };
}

export function useAssetHistory(id: string, intervalLabel: string) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    const fetchHistory = async () => {
      setLoading(true);
      const interval = marketService.getIntervalForLabel(intervalLabel);
      const data = await marketService.getAssetHistory(id, interval);
      
      // Limit data points for sparklines
      const points = data.map(d => parseFloat(d.priceUsd));
      setHistory(points);
      setLoading(false);
    };

    fetchHistory();
  }, [id, intervalLabel]);

  return { history, loading };
}
