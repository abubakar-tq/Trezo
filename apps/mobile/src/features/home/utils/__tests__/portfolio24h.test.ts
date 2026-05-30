import { computeTotalChange24h } from "../portfolio24h";
import type { Holding24h } from "../portfolio24h";

// ── tiny assert helpers ─────────────────────────────────────────────────────
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

function assertNull(actual: unknown, label: string) {
  if (actual !== null) {
    console.error(
      `FAIL: ${label}\n  expected: null\n  actual:   ${JSON.stringify(actual)}`,
    );
    process.exit(1);
  }
  passed++;
}

function assertClose(
  actual: number,
  expected: number,
  label: string,
  epsilon = 1e-9,
) {
  if (Math.abs(actual - expected) > epsilon) {
    console.error(
      `FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`,
    );
    process.exit(1);
  }
  passed++;
}

// ── tests ────────────────────────────────────────────────────────────────────
console.log("running portfolio24h.test.ts");

// 1. All-null holdings → null (no known 24h data)
{
  const holdings: Holding24h[] = [
    { value: 1000, changePct24h: null },
    { value: 500, changePct24h: null },
  ];
  const result = computeTotalChange24h(holdings);
  assertNull(result, "all-null: returns null");
}

// 2. Empty array → null
{
  const result = computeTotalChange24h([]);
  assertNull(result, "empty array: returns null");
}

// 3. Single holding up 10% on $110 current value
//    value24hAgo = 110 / 1.10 = 100
//    delta = 110 − 100 = 10
//    pct   = 10 / 100 × 100 = 10%
{
  const holdings: Holding24h[] = [{ value: 110, changePct24h: 10 }];
  const result = computeTotalChange24h(holdings);
  assertEqual(result !== null, true, "single +10%: not null");
  assertClose(result!.delta, 10, "single +10%: delta = 10");
  assertClose(result!.pct, 10, "single +10%: pct = 10");
}

// 4. Mixed holdings — one with known pct, one null
//    Known: $110 @ +10% → value24hAgo = 100
//    Null:  $200 → excluded entirely
//    delta = 110 − 100 = 10; pct = 10%
{
  const holdings: Holding24h[] = [
    { value: 110, changePct24h: 10 },
    { value: 200, changePct24h: null },
  ];
  const result = computeTotalChange24h(holdings);
  assertEqual(result !== null, true, "mixed: not null");
  assertClose(result!.delta, 10, "mixed: null contribution excluded from delta");
  assertClose(result!.pct, 10, "mixed: null excluded from 24h-ago base");
}

// 5. Multiple known holdings
//    Token A: $200 @ +25%  → value24hAgo = 200/1.25 = 160
//    Token B: $75  @ -25%  → value24hAgo = 75/0.75  = 100
//    totalNow    = 275
//    total24hAgo = 260
//    delta = 15; pct = 15/260 × 100 ≈ 5.769…%
{
  const holdings: Holding24h[] = [
    { value: 200, changePct24h: 25 },
    { value: 75, changePct24h: -25 },
  ];
  const result = computeTotalChange24h(holdings);
  assertEqual(result !== null, true, "two known: not null");
  assertClose(result!.delta, 15, "two known: delta = 15", 1e-6);
  assertClose(
    result!.pct,
    (15 / 260) * 100,
    "two known: pct ≈ 5.769%",
    1e-6,
  );
}

// 6. Zero-base guard: value=0, pct=anything → should still return null
//    (value24hAgo = 0/1.10 = 0, Σvalue24hAgo = 0 → guard → null)
{
  const holdings: Holding24h[] = [{ value: 0, changePct24h: 10 }];
  const result = computeTotalChange24h(holdings);
  assertNull(result, "zero-base guard: returns null to avoid NaN/Infinity");
}

// 7. changePct24h = 0 (no change) — valid, not treated as null
//    value24hAgo = 50 / 1.00 = 50; delta = 0; pct = 0
{
  const holdings: Holding24h[] = [{ value: 50, changePct24h: 0 }];
  const result = computeTotalChange24h(holdings);
  assertEqual(result !== null, true, "pct=0: not null");
  assertClose(result!.delta, 0, "pct=0: delta = 0", 1e-6);
  assertClose(result!.pct, 0, "pct=0: pct = 0", 1e-6);
}

console.log(`OK portfolio24h.test.ts (${passed} assertions)`);
