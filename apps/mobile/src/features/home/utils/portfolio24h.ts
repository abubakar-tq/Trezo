/**
 * portfolio24h — pure helper for aggregating portfolio-level 24h change.
 *
 * Design rule (spec §5.1 + data task):
 *   Per token with a known 24h %:
 *     value24hAgo = value / (1 + pct/100)
 *   Portfolio delta  = Σvalue − Σvalue24hAgo
 *   Portfolio pct    = delta / Σvalue24hAgo × 100
 *
 *   When NO held token has a market 24h match → returns null (render nothing).
 *   Never fabricates a 0% when data is unavailable.
 */

export interface Holding24h {
  /** Current USD value of this holding. */
  value: number;
  /** 24h price change % for this token, or null when unknown. */
  changePct24h: number | null;
}

export interface Change24hResult {
  /** Absolute portfolio USD change over the past 24h. */
  delta: number;
  /** Portfolio % change over the past 24h (deposit-neutral denominator). */
  pct: number;
}

/**
 * Aggregate portfolio 24h change across all holdings.
 *
 * Returns null when:
 *   - holdings is empty, OR
 *   - no holding has a known changePct24h (all null).
 *
 * Holdings with null changePct24h are excluded from the calculation entirely —
 * both their current value AND their 24h-ago base are excluded so they cannot
 * distort the result.
 */
export function computeTotalChange24h(
  holdings: Holding24h[],
): Change24hResult | null {
  let totalValueNow = 0;
  let totalValue24hAgo = 0;
  let knownCount = 0;

  for (const h of holdings) {
    if (h.changePct24h === null || !isFinite(h.changePct24h)) continue;
    if (!isFinite(h.value) || h.value < 0) continue;

    const value24hAgo = h.value / (1 + h.changePct24h / 100);
    if (!isFinite(value24hAgo)) continue;

    totalValueNow += h.value;
    totalValue24hAgo += value24hAgo;
    knownCount++;
  }

  if (knownCount === 0) return null;
  if (totalValue24hAgo === 0) return null; // guard against NaN / Infinity

  const delta = totalValueNow - totalValue24hAgo;
  const pct = (delta / totalValue24hAgo) * 100;

  return { delta, pct };
}
