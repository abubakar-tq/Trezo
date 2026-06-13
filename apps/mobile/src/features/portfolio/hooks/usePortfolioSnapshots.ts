import { useState, useEffect, useCallback } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { storageService } from "@/src/services/StorageService";
import {
  toDayIndex,
  upsertDailySnapshot,
  walletAgeDays,
  snapshotSeriesForPeriod,
  type DailySnapshot,
} from "../utils/portfolioSnapshots";
import type { Period } from "../utils/portfolioChart";

/**
 * Persists daily portfolio value snapshots in MMKV and exposes tiered helpers.
 *
 * On mount and every time the app comes back to the foreground, writes today's
 * totalBalanceUSD (one row per day; idempotent — overwrites same day).
 *
 * Returns:
 *   snapshots    — raw DailySnapshot[] sorted ascending (for direct use or debugging)
 *   walletAge    — wallet age in days (0 until first snapshot recorded)
 *   seriesForPeriod — totalUsd series for a given Period (delegates to pure helper)
 */
export function usePortfolioSnapshots(
  totalBalanceUSD: number | undefined,
  walletAddress: string | null | undefined,
  chainId: number | undefined
) {
  const storageKey =
    walletAddress && chainId != null
      ? `portfolio_snapshots_v1:${chainId}:${walletAddress.toLowerCase()}`
      : null;

  const readSnapshots = useCallback((): DailySnapshot[] => {
    if (!storageKey) return [];
    return storageService.get<DailySnapshot[]>(storageKey) ?? [];
  }, [storageKey]);

  const [snapshots, setSnapshots] = useState<DailySnapshot[]>(() => readSnapshots());

  const maybeRecord = useCallback(() => {
    if (!storageKey) return;
    if (totalBalanceUSD == null || !isFinite(totalBalanceUSD)) return;

    const today = toDayIndex(Date.now());
    const current = readSnapshots();
    const updated = upsertDailySnapshot(current, today, totalBalanceUSD);
    storageService.set(storageKey, updated);
    setSnapshots(updated);
  }, [storageKey, totalBalanceUSD, readSnapshots]);

  // Record on mount
  useEffect(() => {
    maybeRecord();
  }, [maybeRecord]);

  // Re-record whenever app comes back to foreground
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        maybeRecord();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [maybeRecord]);

  // Refresh snapshots from storage when storageKey changes (wallet/chain switch)
  useEffect(() => {
    setSnapshots(readSnapshots());
  }, [readSnapshots]);

  const walletAge = walletAgeDays(snapshots, toDayIndex(Date.now()));

  const seriesForPeriod = useCallback(
    (period: Period): number[] => snapshotSeriesForPeriod(snapshots, period, toDayIndex(Date.now())),
    [snapshots]
  );

  return { snapshots, walletAge, seriesForPeriod };
}
