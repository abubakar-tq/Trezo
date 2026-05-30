// Pure allocation helper for the Portfolio screen's pie/donut chart.
//
// Kept pure (no react-native imports) so it is unit-testable under the repo's
// tsx test runner. The Portfolio screen maps these segments onto its native chart.

export type Holding = { symbol: string; valueUsd: number };
export type AllocSegment = { symbol: string; valueUsd: number; pct: number };

/** Sorted desc by value; pct of total. Tiny holdings (< minPct) fold into "Other". */
export function computeAllocation(holdings: Holding[], minPct = 3): AllocSegment[] {
  const total = holdings.reduce((s, h) => s + Math.max(0, h.valueUsd), 0);
  if (total <= 0) return [];
  const segs = holdings
    .filter((h) => h.valueUsd > 0)
    .map((h) => ({ symbol: h.symbol, valueUsd: h.valueUsd, pct: (h.valueUsd / total) * 100 }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
  const big = segs.filter((s) => s.pct >= minPct);
  const small = segs.filter((s) => s.pct < minPct);
  if (small.length) {
    const otherVal = small.reduce((s, x) => s + x.valueUsd, 0);
    big.push({ symbol: "Other", valueUsd: otherVal, pct: (otherVal / total) * 100 });
  }
  return big;
}
