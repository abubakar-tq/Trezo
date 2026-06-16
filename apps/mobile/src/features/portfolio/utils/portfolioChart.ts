// Pure helpers for the Portfolio chart tab strip and deposit-adjusted value change.
//
// Kept pure (no react-native imports) so it is unit-testable under the repo's
// tsx test runner. The Portfolio screen maps these onto its native rendering.

export type Period = "1D" | "1W" | "1M" | "1Y" | "ALL";

/** Which periods are enabled given wallet age in days. 1D always on; others need >= their span. */
export function enabledPeriods(walletAgeDays: number): Record<Period, boolean> {
  return {
    "1D": true,
    "1W": walletAgeDays >= 7,
    "1M": walletAgeDays >= 30,
    "1Y": walletAgeDays >= 365,
    "ALL": walletAgeDays >= 1,
  };
}

/** Warm message shown when a disabled period is tapped (NO lock icon in UI). */
export function disabledPeriodMessage(period: Period, walletAgeDays: number): string {
  return `${period} isn't ready yet — your wallet is ${walletAgeDays} day${walletAgeDays === 1 ? "" : "s"} old. Showing since you started for now.`;
}

/** Deposit-adjusted value change over a window. netFlows = deposits - withdrawals (USD) during the window. */
export function valueChange(startValue: number, endValue: number, netFlows: number): { delta: number; pct: number } {
  const adjustedStart = startValue + netFlows; // funding raises the baseline, not the gain
  const delta = endValue - adjustedStart;
  const pct = adjustedStart > 0 ? (delta / adjustedStart) * 100 : 0;
  return { delta, pct };
}
