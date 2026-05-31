// Pure helpers for managing daily portfolio value snapshots.
//
// Kept pure (no react-native imports) so it is unit-testable under the repo's
// tsx test runner. The hook (usePortfolioSnapshots) handles MMKV persistence;
// this module is only math and data transformations.

import type { Period } from "./portfolioChart";

export type DailySnapshot = { day: number; totalUsd: number }; // day = integer UTC day index (days since unix epoch)

/** Integer UTC day index from an epoch-ms timestamp. */
export function toDayIndex(epochMs: number): number {
  return Math.floor(epochMs / 86_400_000);
}

/** Insert or replace the snapshot for `day` (one row per day). Returns a NEW array sorted ascending by day. */
export function upsertDailySnapshot(snapshots: DailySnapshot[], day: number, totalUsd: number): DailySnapshot[] {
  const others = snapshots.filter((s) => s.day !== day);
  return [...others, { day, totalUsd }].sort((a, b) => a.day - b.day);
}

/** Wallet age in days = today - earliest snapshot day. 0 when there are no snapshots. */
export function walletAgeDays(snapshots: DailySnapshot[], today: number): number {
  if (snapshots.length === 0) return 0;
  const earliest = Math.min(...snapshots.map((s) => s.day));
  return Math.max(0, today - earliest);
}

/** totalUsd series (ascending by day) for a period window ending at `today`.
 *  1D → [] (1D uses the live intraday price feed, handled by the caller, NOT snapshots).
 *  ALL → the full snapshot series. 1W/1M/1Y → snapshots within the trailing window. */
export function snapshotSeriesForPeriod(snapshots: DailySnapshot[], period: Period, today: number): number[] {
  const sorted = [...snapshots].sort((a, b) => a.day - b.day);
  if (period === "1D") return [];
  if (period === "ALL") return sorted.map((s) => s.totalUsd);
  const span = period === "1W" ? 7 : period === "1M" ? 30 : 365; // 1Y
  return sorted.filter((s) => s.day >= today - span).map((s) => s.totalUsd);
}
