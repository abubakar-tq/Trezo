import { enabledPeriods, disabledPeriodMessage, valueChange } from "../portfolioChart";

// ── tiny assert helpers ─────────────────────────────────────────────────────
let passed = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
  passed++;
}

function assertClose(actual: number, expected: number, label: string, epsilon = 1e-9) {
  if (Math.abs(actual - expected) > epsilon) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
  passed++;
}

// ── tests ────────────────────────────────────────────────────────────────────
console.log("running portfolioChart.test.ts");

// enabledPeriods: age 0 → only 1D true; ALL, 1W, 1M, 1Y false
{
  const p = enabledPeriods(0);
  assertEqual(p["1D"], true, "age 0: 1D enabled");
  assertEqual(p["1W"], false, "age 0: 1W disabled");
  assertEqual(p["1M"], false, "age 0: 1M disabled");
  assertEqual(p["1Y"], false, "age 0: 1Y disabled");
  assertEqual(p["ALL"], false, "age 0: ALL disabled");
}

// enabledPeriods: age 3 → 1D + ALL true; 1W, 1M, 1Y false
{
  const p = enabledPeriods(3);
  assertEqual(p["1D"], true, "age 3: 1D enabled");
  assertEqual(p["1W"], false, "age 3: 1W disabled");
  assertEqual(p["1M"], false, "age 3: 1M disabled");
  assertEqual(p["1Y"], false, "age 3: 1Y disabled");
  assertEqual(p["ALL"], true, "age 3: ALL enabled");
}

// enabledPeriods: age 400 → all true
{
  const p = enabledPeriods(400);
  assertEqual(p["1D"], true, "age 400: 1D enabled");
  assertEqual(p["1W"], true, "age 400: 1W enabled");
  assertEqual(p["1M"], true, "age 400: 1M enabled");
  assertEqual(p["1Y"], true, "age 400: 1Y enabled");
  assertEqual(p["ALL"], true, "age 400: ALL enabled");
}

// valueChange: deposit does NOT count as gain
// start=100, end=600, netFlows=500 → adjustedStart=600, delta=0, pct=0
{
  const r = valueChange(100, 600, 500);
  assertClose(r.delta, 0, "deposit not gain: delta=0");
  assertClose(r.pct, 0, "deposit not gain: pct=0");
}

// valueChange: ordinary gain — start=100, end=150, netFlows=0 → delta=50, pct=50
{
  const r = valueChange(100, 150, 0);
  assertClose(r.delta, 50, "ordinary gain: delta=50");
  assertClose(r.pct, 50, "ordinary gain: pct=50");
}

// disabledPeriodMessage: contains wallet age number and "since you started"
{
  const msg = disabledPeriodMessage("1W", 5);
  assertEqual(msg.includes("5"), true, "message contains wallet age (5)");
  assertEqual(msg.includes("since you started"), true, "message contains 'since you started'");
}

// disabledPeriodMessage: singular day (1 day)
{
  const msg = disabledPeriodMessage("1M", 1);
  assertEqual(msg.includes("1 day"), true, "singular: '1 day'");
}

// disabledPeriodMessage: plural days (2 days)
{
  const msg = disabledPeriodMessage("1M", 2);
  assertEqual(msg.includes("2 days"), true, "plural: '2 days'");
}

console.log(`OK portfolioChart.test.ts (${passed} assertions)`);
