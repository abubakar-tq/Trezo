import { describe, it, expect } from "vitest";
import { computeTotalChange24h } from "./change24h";

describe("computeTotalChange24h", () => {
  it("returns null for empty holdings", () => {
    expect(computeTotalChange24h([])).toBeNull();
  });

  it("returns null when all holdings have null changePct24h", () => {
    expect(
      computeTotalChange24h([
        { value: 1000, changePct24h: null },
        { value: 500, changePct24h: null },
      ]),
    ).toBeNull();
  });

  it("computes correct delta and pct for a single holding", () => {
    // ETH worth $1100 now, up 10% → was $1000 yesterday
    const result = computeTotalChange24h([
      { value: 1100, changePct24h: 10 },
    ]);
    expect(result).not.toBeNull();
    // delta = 1100 - 1000 = 100
    expect(result!.delta).toBeCloseTo(100, 6);
    // pct = 100 / 1000 * 100 = 10%
    expect(result!.pct).toBeCloseTo(10, 6);
  });

  it("aggregates two holdings and weights by value", () => {
    // ETH: $1000, up 10%  →  24h-ago $909.09…
    // USDC: $500, up 0%   →  24h-ago $500
    const result = computeTotalChange24h([
      { value: 1000, changePct24h: 10 },
      { value: 500, changePct24h: 0 },
    ]);
    expect(result).not.toBeNull();
    const value24hAgo = 1000 / 1.1 + 500; // ≈ 1409.09
    const expectedDelta = 1500 - value24hAgo;
    const expectedPct = (expectedDelta / value24hAgo) * 100;
    expect(result!.delta).toBeCloseTo(expectedDelta, 5);
    expect(result!.pct).toBeCloseTo(expectedPct, 5);
  });

  it("excludes holdings with null changePct24h from calculation", () => {
    // Only ETH with 10% should contribute; unknown token ignored.
    const withUnknown = computeTotalChange24h([
      { value: 1100, changePct24h: 10 },
      { value: 9999, changePct24h: null },
    ]);
    const withoutUnknown = computeTotalChange24h([
      { value: 1100, changePct24h: 10 },
    ]);
    expect(withUnknown).not.toBeNull();
    expect(withUnknown!.pct).toBeCloseTo(withoutUnknown!.pct, 6);
    expect(withUnknown!.delta).toBeCloseTo(withoutUnknown!.delta, 6);
  });

  it("returns null for non-finite changePct24h values", () => {
    expect(
      computeTotalChange24h([
        { value: 100, changePct24h: Infinity },
      ]),
    ).toBeNull();
  });

  it("handles negative change (loss)", () => {
    // Token worth $900 now, down 10% → was $1000 yesterday
    const result = computeTotalChange24h([
      { value: 900, changePct24h: -10 },
    ]);
    expect(result).not.toBeNull();
    // value24hAgo = 900 / (1 - 0.10) = 900 / 0.9 = 1000
    expect(result!.delta).toBeCloseTo(-100, 5);
    expect(result!.pct).toBeCloseTo(-10, 5);
  });
});
