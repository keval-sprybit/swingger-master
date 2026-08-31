import { describe, it, expect } from "vitest";
import { smaSeries } from "../src/services/chartService.js";

// Acceptance tests for the chart data service (the source of truth behind the
// candlestick / volume chart). These verify that moving-average series used by
// the chart are computed only from real data and are null (INSUFFICIENT DATA)
// until enough history exists — never fabricated.

describe("smaSeries (chart moving averages)", () => {
  it("returns nulls until the full window is available (no invented values)", () => {
    const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const s = smaSeries(closes, 20);
    expect(s.length).toBe(10);
    for (let i = 0; i < 10; i++) expect(s[i]).toBeNull();
  });

  it("computes a correct rolling 2-period average", () => {
    const closes = [2, 4, 6, 8];
    const s = smaSeries(closes, 2);
    expect(s).toEqual([null, 3, 5, 7]);
  });

  it("computes a correct rolling 3-period average", () => {
    const closes = [1, 2, 3, 4, 5];
    const s = smaSeries(closes, 3);
    expect(s[0]).toBeNull();
    expect(s[1]).toBeNull();
    expect(s[2]).toBeCloseTo(2, 10);
    expect(s[3]).toBeCloseTo(3, 10);
    expect(s[4]).toBeCloseTo(4, 10);
  });

  it("20 DMA is available only once there are >= 20 bars", () => {
    const closes = Array.from({ length: 19 }, (_, i) => 10 + i);
    expect(smaSeries(closes, 20).every((v) => v === null)).toBe(true);
    // closes 10..29 — the 20-bar mean is (10+29)/2 = 19.5
    const closes20 = Array.from({ length: 20 }, (_, i) => 10 + i);
    const s20 = smaSeries(closes20, 20);
    expect(s20[s20.length - 1]).toBeCloseTo((10 + 29) / 2, 6);
  });

  it("200 DMA is null when fewer than 200 bars are stored", () => {
    const closes = Array.from({ length: 50 }, () => 100);
    const s = smaSeries(closes, 200);
    expect(s.every((v) => v === null)).toBe(true);
  });

  it("matches the sum-of-n-closes average for a 4-period window", () => {
    const closes = [1, 5, 9, 13, 17, 21, 25, 29];
    const s = smaSeries(closes, 4);
    expect(s[0]).toBeNull();
    expect(s[1]).toBeNull();
    expect(s[2]).toBeNull();
    expect(s[3]).toBeCloseTo(7, 10);
    expect(s[4]).toBeCloseTo(11, 10);
    expect(s[5]).toBeCloseTo(15, 10);
    expect(s[6]).toBeCloseTo(19, 10);
    expect(s[7]).toBeCloseTo(23, 10);
  });
});
