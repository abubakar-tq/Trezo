import {
  toDayIndex,
  upsertDailySnapshot,
  walletAgeDays,
  snapshotSeriesForPeriod,
  type DailySnapshot,
} from "../portfolioSnapshots";

// ── tiny assert helpers ─────────────────────────────────────────────────────
let passed = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
  passed++;
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
    process.exit(1);
  }
  passed++;
}

// ── tests ────────────────────────────────────────────────────────────────────
console.log("running portfolioSnapshots.test.ts");

// toDayIndex
{
  assertEqual(toDayIndex(0), 0, "toDayIndex: 0ms → day 0");
  assertEqual(toDayIndex(86_400_000), 1, "toDayIndex: 86_400_000ms → day 1");
  assertEqual(toDayIndex(86_400_000 * 10 + 5000), 10, "toDayIndex: day 10 + 5000ms → day 10");
  // sanity: just below 2 full days → day 1
  assertEqual(toDayIndex(86_400_000 * 2 - 1), 1, "toDayIndex: 2 days - 1ms → day 1");
}

// upsertDailySnapshot: inserting a new day
{
  const base: DailySnapshot[] = [{ day: 5, totalUsd: 100 }, { day: 3, totalUsd: 50 }];
  const result = upsertDailySnapshot(base, 4, 75);
  // should be sorted ascending: [3,4,5]
  assertDeepEqual(
    result,
    [{ day: 3, totalUsd: 50 }, { day: 4, totalUsd: 75 }, { day: 5, totalUsd: 100 }],
    "upsert new day: sorted ascending, inserted in middle"
  );
  // original unchanged (new array returned)
  assertEqual(base.length, 2, "upsert: original array unchanged");
}

// upsertDailySnapshot: upserting existing day REPLACES totalUsd, length unchanged
{
  const base: DailySnapshot[] = [{ day: 10, totalUsd: 200 }, { day: 12, totalUsd: 300 }];
  const result = upsertDailySnapshot(base, 10, 999);
  assertEqual(result.length, 2, "upsert existing: length unchanged");
  assertEqual(result[0].totalUsd, 999, "upsert existing: totalUsd replaced");
  assertEqual(result[0].day, 10, "upsert existing: day preserved");
  assertEqual(result[1].day, 12, "upsert existing: second entry intact");
}

// upsertDailySnapshot: result always sorted ascending
{
  const base: DailySnapshot[] = [{ day: 20, totalUsd: 500 }];
  const result = upsertDailySnapshot(base, 5, 100);
  assertEqual(result[0].day, 5, "upsert: new earlier day at index 0");
  assertEqual(result[1].day, 20, "upsert: original day at index 1");
}

// walletAgeDays: empty → 0
{
  assertEqual(walletAgeDays([], 100), 0, "walletAgeDays: empty snapshots → 0");
}

// walletAgeDays: snapshots at days [10,11,15], today=15 → 5
{
  const snaps: DailySnapshot[] = [
    { day: 10, totalUsd: 100 },
    { day: 11, totalUsd: 110 },
    { day: 15, totalUsd: 150 },
  ];
  assertEqual(walletAgeDays(snaps, 15), 5, "walletAgeDays: days [10,11,15] today=15 → 5");
}

// walletAgeDays: today equal to earliest → 0
{
  const snaps: DailySnapshot[] = [{ day: 7, totalUsd: 200 }, { day: 9, totalUsd: 300 }];
  assertEqual(walletAgeDays(snaps, 7), 0, "walletAgeDays: today === earliest → 0");
}

// snapshotSeriesForPeriod: 1D → []
{
  const snaps: DailySnapshot[] = [{ day: 1, totalUsd: 10 }, { day: 2, totalUsd: 20 }];
  assertDeepEqual(snapshotSeriesForPeriod(snaps, "1D", 2), [], "snapshotSeriesForPeriod: 1D → []");
}

// snapshotSeriesForPeriod: ALL → all totals in ascending-day order
{
  const snaps: DailySnapshot[] = [
    { day: 5, totalUsd: 500 },
    { day: 1, totalUsd: 100 },
    { day: 3, totalUsd: 300 },
  ];
  assertDeepEqual(
    snapshotSeriesForPeriod(snaps, "ALL", 10),
    [100, 300, 500],
    "snapshotSeriesForPeriod: ALL → ascending order totals"
  );
}

// snapshotSeriesForPeriod: 1W with today=20 and days [10,14,18,20] → only days >= 13 → [14,18,20] totals
{
  const snaps: DailySnapshot[] = [
    { day: 10, totalUsd: 1000 },
    { day: 14, totalUsd: 1400 },
    { day: 18, totalUsd: 1800 },
    { day: 20, totalUsd: 2000 },
  ];
  // today=20, span=7, cutoff = 20-7 = 13 → days >= 13 → [14,18,20]
  assertDeepEqual(
    snapshotSeriesForPeriod(snaps, "1W", 20),
    [1400, 1800, 2000],
    "snapshotSeriesForPeriod: 1W today=20 → days [14,18,20]"
  );
}

// snapshotSeriesForPeriod: ascending order preserved
{
  const snaps: DailySnapshot[] = [
    { day: 30, totalUsd: 300 },
    { day: 25, totalUsd: 250 },
    { day: 28, totalUsd: 280 },
  ];
  const result = snapshotSeriesForPeriod(snaps, "1W", 30);
  // today=30, span=7, cutoff=23 → all 3 qualify; should be [250,280,300]
  assertDeepEqual(result, [250, 280, 300], "snapshotSeriesForPeriod: 1W ascending order from unsorted input");
}

console.log(`OK portfolioSnapshots.test.ts (${passed} assertions)`);
