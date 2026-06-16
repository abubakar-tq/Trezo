import { isDeadlineLive, isAttemptLive, RECOVERY_ATTEMPT_TTL_MS } from "../recoveryLiveness";

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

console.log("running recoveryLiveness.test.ts");

const NOW = 1_700_000_000_000; // fixed clock so the tests are deterministic
const iso = (ms: number) => new Date(ms).toISOString();

// ── isDeadlineLive — a recovery request past its deadline must not count as active ──
assertEqual(isDeadlineLive(iso(NOW + 60_000), NOW), true, "future deadline -> live");
assertEqual(isDeadlineLive(iso(NOW - 60_000), NOW), false, "past deadline -> not live");
assertEqual(isDeadlineLive(iso(NOW), NOW), false, "exactly at deadline -> not live");
assertEqual(isDeadlineLive(null, NOW), true, "null deadline -> not filtered on deadline grounds");
assertEqual(isDeadlineLive(undefined, NOW), true, "undefined deadline -> live");
assertEqual(isDeadlineLive("not-a-date", NOW), true, "invalid deadline -> live (don't hide on bad data)");

// ── isAttemptLive — a recovery attempt older than the pre-vote TTL is stale ──────
assertEqual(RECOVERY_ATTEMPT_TTL_MS, 24 * 60 * 60 * 1000, "TTL is the documented 24h pre-vote window");
assertEqual(isAttemptLive(iso(NOW - 60_000), NOW), true, "1m old -> live");
assertEqual(isAttemptLive(iso(NOW - 23 * 3600 * 1000), NOW), true, "23h old -> live");
assertEqual(isAttemptLive(iso(NOW - 25 * 3600 * 1000), NOW), false, "25h old -> stale (not live)");
assertEqual(isAttemptLive(iso(NOW - 24 * 3600 * 1000), NOW), false, "exactly TTL old -> stale");
assertEqual(isAttemptLive(null, NOW), true, "null createdAt -> live (conservative: don't hide a real attempt)");
assertEqual(isAttemptLive("nope", NOW), true, "invalid createdAt -> live");
// honours an explicit TTL override
assertEqual(isAttemptLive(iso(NOW - 2 * 3600 * 1000), NOW, 3600 * 1000), false, "2h old with 1h TTL -> stale");

console.log(`OK recoveryLiveness.test.ts (${passed} assertions)`);
