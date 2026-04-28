import { useState, useEffect, useCallback, useMemo } from 'react';
import { marketService, MarketAsset } from '../../services/MarketService';
import { binanceWS, PriceUpdate } from '../../services/BinanceWS';

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

  const symbolsKey = useMemo(() => assets.map(a => a.symbol).join(','), [assets]);

  // Real-time updates via WebSocket with Throttled Batching
  useEffect(() => {
    if (assets.length === 0) return;

    const symbols = assets.map(a => a.symbol);
    
    binanceWS.connect(symbols);

    const updatesBuffer = new Map<string, PriceUpdate>();
    const handleUpdate = (update: PriceUpdate) => {
      updatesBuffer.set(update.symbol, update);
    };

    // Apply batched updates to ensure smooth UI
    const batchInterval = setInterval(() => {
      if (updatesBuffer.size === 0) return;
      
      const currentUpdates = Array.from(updatesBuffer.values());
      updatesBuffer.clear();

      setAssets(currentAssets => {
        let changed = false;
        const nextAssets = currentAssets.map(asset => {
          const update = currentUpdates.find(u => u.symbol === asset.symbol);
          if (update && (update.price !== asset.priceUsd || update.changePercent !== asset.changePercent24Hr)) {
            changed = true;
            return { ...asset, priceUsd: update.price, changePercent24Hr: update.changePercent };
          }
          return asset;
        });
        return changed ? nextAssets : currentAssets;
      });
    }, 5000); // 5 seconds is the sweet spot for battery life and fluid navigation on low-end devices

    symbols.forEach(s => binanceWS.subscribe(s, handleUpdate));

    return () => {
      clearInterval(batchInterval);
      symbols.forEach(s => binanceWS.unsubscribe(s, handleUpdate));
    };
  }, [symbolsKey]); 

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
      const points = data.map((d: any) => parseFloat(d.priceUsd));
      setHistory(points);
      setLoading(false);
    };

    fetchHistory();
  }, [id, intervalLabel]);

  return { history, loading };
}
