import { computeAllocation, type AllocSegment } from "../allocation";

// ── tiny assert helpers ─────────────────────────────────────────────────────
let passed = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
  passed++;
}

function assertClose(actual: number, expected: number, label: string, epsilon = 1e-6) {
  if (Math.abs(actual - expected) > epsilon) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
  passed++;
}

// ── tests ────────────────────────────────────────────────────────────────────
console.log("running allocation.test.ts");

// empty array → []
{
  const result = computeAllocation([]);
  assertEqual(result.length, 0, "empty input → empty output");
}

// all-zero values → []
{
  const result = computeAllocation([{ symbol: "ETH", valueUsd: 0 }]);
  assertEqual(result.length, 0, "all-zero input → empty output");
}

// multi-holding case: pcts sum to ~100%
{
  const holdings = [
    { symbol: "ETH", valueUsd: 500 },
    { symbol: "USDC", valueUsd: 300 },
    { symbol: "BTC", valueUsd: 200 },
  ];
  const result = computeAllocation(holdings);
  const totalPct = result.reduce((s, seg) => s + seg.pct, 0);
  assertClose(totalPct, 100, "pcts sum to 100%");
}

// multi-holding case: correct pct values
{
  const holdings = [
    { symbol: "ETH", valueUsd: 500 },
    { symbol: "USDC", valueUsd: 300 },
    { symbol: "BTC", valueUsd: 200 },
  ];
  const result = computeAllocation(holdings);
  // All are >= 3% so no "Other" folding
  assertEqual(result.length, 3, "three large holdings → three segments");
  const eth = result.find((s) => s.symbol === "ETH");
  assertClose(eth!.pct, 50, "ETH pct = 50%");
}

// small holdings fold into "Other"
{
  const holdings = [
    { symbol: "ETH", valueUsd: 900 },
    { symbol: "SHIB", valueUsd: 10 },  // 1% < 3% minPct → folded
    { symbol: "DOGE", valueUsd: 90 },
  ];
  const result = computeAllocation(holdings);
  const symbols = result.map((s) => s.symbol);
  assertEqual(symbols.includes("SHIB"), false, "tiny holding not present as own segment");
  assertEqual(symbols.includes("Other"), true, "tiny holding folded into 'Other'");
  const other = result.find((s) => s.symbol === "Other");
  assertClose(other!.valueUsd, 10, "Other.valueUsd = 10");
}

// result sorted descending by value
{
  const holdings = [
    { symbol: "USDC", valueUsd: 200 },
    { symbol: "ETH", valueUsd: 600 },
    { symbol: "BTC", valueUsd: 400 },
  ];
  const result = computeAllocation(holdings);
  assertEqual(result[0].symbol, "ETH", "first segment is highest-value (ETH)");
  assertEqual(result[1].symbol, "BTC", "second segment is second-highest (BTC)");
  assertEqual(result[2].symbol, "USDC", "third segment is lowest (USDC)");
}

// custom minPct: fold at 10%
{
  const holdings = [
    { symbol: "ETH", valueUsd: 800 },
    { symbol: "USDC", valueUsd: 150 },  // 15% ≥ 10% → kept
    { symbol: "SHIB", valueUsd: 50 },   // 5% < 10% → folded
  ];
  const result = computeAllocation(holdings, 10);
  const symbols = result.map((s) => s.symbol);
  assertEqual(symbols.includes("SHIB"), false, "SHIB below custom minPct → folded");
  assertEqual(symbols.includes("Other"), true, "Other present with custom minPct=10");
}

console.log(`OK allocation.test.ts (${passed} assertions)`);
