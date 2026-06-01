export function delayLabel(seconds: number): string {
  const map: Record<number, string> = {
    86400: "24 hours",
    172800: "48 hours",
    604800: "7 days",
  };
  const h = Math.round(seconds / 3600);
  return map[seconds] ?? `${h} ${h === 1 ? "hour" : "hours"}`;
}

export const DELAY_CHOICES = [
  { seconds: 86400, label: "24 hours", note: "" },
  { seconds: 172800, label: "48 hours", note: "Recommended" },
  { seconds: 604800, label: "7 days", note: "Most cautious" },
] as const;

// Dev/testing-only short delays. The deployed Base Sepolia module uses
// minimumDelay = 0, so any delay is valid on-chain as long as the derived
// expiry keeps the recovery window >= MIN_RECOVERY_WINDOW_MINUTES. These are
// gated behind the Dev Controls "Allow short recovery delays" toggle so the
// execute step can be exercised without waiting out a 24–48h production delay.
export const DEV_DELAY_CHOICES = [
  { seconds: 300, label: "5 min", note: "Testing" },
  { seconds: 1800, label: "30 min", note: "Testing" },
  { seconds: 3600, label: "1 hour", note: "Testing" },
] as const;

// On-chain EmailRecoveryManager.configureRecovery enforces
//   expiry - delay >= MINIMUM_RECOVERY_WINDOW (= 2 days = 2880 minutes).
// This is the *only* timing floor on Base Sepolia (minimumDelay = 0), so the
// delay itself is free — only the window matters.
export const MIN_RECOVERY_WINDOW_MINUTES = 2880; // 2 days — the contract floor

// We always grant a generous, fixed recovery window (the span during which an
// approved recovery can still be executed). Deriving expiry from the chosen
// delay guarantees the on-chain floor is met for every delay option, instead of
// carrying a fixed expiry that can silently fall below it.
export const RECOVERY_WINDOW_MINUTES = 20160; // 14 days

/**
 * Derive the on-chain `expiry` (in minutes) from the chosen `delay` (in minutes)
 * so that `expiry - delay === RECOVERY_WINDOW_MINUTES`, which is always >= the
 * contract's MIN_RECOVERY_WINDOW_MINUTES floor.
 */
export function deriveExpiryMinutes(delayMinutes: number): number {
  return Math.max(delayMinutes, 0) + RECOVERY_WINDOW_MINUTES;
}

export function approvalsSummary(threshold: number, total: number): string {
  return `${threshold} of ${total} approvals`;
}
