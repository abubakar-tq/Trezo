import { delayLabel, approvalsSummary, DELAY_CHOICES } from "../recoveryLabels";

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

console.log(`OK recoveryLabels.test.ts (${passed} assertions)`);
