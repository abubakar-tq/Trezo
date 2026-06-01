import {
  delayLabel,
  approvalsSummary,
  DELAY_CHOICES,
  DEV_DELAY_CHOICES,
  deriveExpiryMinutes,
  MIN_RECOVERY_WINDOW_MINUTES,
} from "../recoveryLabels";

// ── tiny assert helpers ────────────────────────────────────────────────────────
let passed = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    console.error(
      `FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
    );
    process.exit(1);
  }
  passed++;
}

// ── tests ──────────────────────────────────────────────────────────────────────
console.log("running recoveryLabels.test.ts");

// delayLabel — known values
assertEqual(delayLabel(86400), "24 hours", "86400s -> 24 hours");
assertEqual(delayLabel(172800), "48 hours", "172800s -> 48 hours");
assertEqual(delayLabel(604800), "7 days", "604800s -> 7 days");

// delayLabel — fallback (rounds to nearest hour)
assertEqual(delayLabel(3600), "1 hour", "3600s -> 1 hour fallback");
assertEqual(delayLabel(7200), "2 hours", "7200s -> 2 hours fallback");

// approvalsSummary
assertEqual(approvalsSummary(2, 3), "2 of 3 approvals", "2 of 3 approvals");
assertEqual(approvalsSummary(1, 1), "1 of 1 approvals", "1 of 1 approvals");

// DELAY_CHOICES structural sanity
assertEqual(DELAY_CHOICES.length, 3, "DELAY_CHOICES has 3 entries");
assertEqual(DELAY_CHOICES[1].note, "Recommended", "middle choice is Recommended");
assertEqual(DELAY_CHOICES[0].seconds, 86400, "first choice is 24h");
assertEqual(DELAY_CHOICES[2].seconds, 604800, "last choice is 7 days");

// ── deriveExpiryMinutes — the on-chain window invariant ─────────────────────────
// Regression guard for the "Turn on Email Recovery" button being permanently
// disabled: every selectable delay must yield expiry such that
//   expiry - delay >= MIN_RECOVERY_WINDOW_MINUTES (the contract's 2-day floor).
// The old hardcoded expiry of 2940 min produced only a 60-min window for the
// 48h delay, which is what blacked out the button.
function assertWindowOk(delaySeconds: number, label: string) {
  const delayMinutes = Math.round(delaySeconds / 60);
  const window = deriveExpiryMinutes(delayMinutes) - delayMinutes;
  if (window < MIN_RECOVERY_WINDOW_MINUTES) {
    console.error(
      `FAIL: ${label}\n  window ${window} min < floor ${MIN_RECOVERY_WINDOW_MINUTES} min`,
    );
    process.exit(1);
  }
  passed++;
}

for (const choice of DELAY_CHOICES) {
  assertWindowOk(choice.seconds, `prod delay ${choice.label} keeps window >= floor`);
}
for (const choice of DEV_DELAY_CHOICES) {
  assertWindowOk(choice.seconds, `dev delay ${choice.label} keeps window >= floor`);
}

// Explicitly pin the 48h-delay case that previously failed.
assertEqual(
  deriveExpiryMinutes(2880) - 2880 >= MIN_RECOVERY_WINDOW_MINUTES,
  true,
  "48h delay (2880m) yields a window >= 2880m floor",
);

// DEV_DELAY_CHOICES structural sanity
assertEqual(DEV_DELAY_CHOICES.length, 3, "DEV_DELAY_CHOICES has 3 entries");
assertEqual(DEV_DELAY_CHOICES[0].seconds, 300, "first dev choice is 5 min");

console.log(`OK recoveryLabels.test.ts (${passed} assertions)`);
