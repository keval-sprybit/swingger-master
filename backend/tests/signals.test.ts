import { describe, it, expect } from "vitest";
import { computeSignals } from "../src/analysis/signals.js";
import { MetricInput } from "../src/analysis/types.js";

function makeMetric(overrides: Partial<MetricInput> = {}): MetricInput {
  return {
    stockId: 1,
    symbol: "TEST",
    ltp: 100,
    changePercent: 2,
    volume: 1000000n,
    turnover: 5,
    volumeRatio1w: null,
    volumeRatio2w: null,
    closePosition: 0.75,
    dayRange: 5,
    previousClose: 98,
    highPrice: 102,
    lowPrice: 97,
    openPrice: 99,
    isMostActiveVolume: false,
    isMostActiveValue: false,
    isVolumeGainer: false,
    is52wHigh: false,
    is52wLow: false,
    isTopGainer: false,
    isTopLoser: false,
    bulkBuyQuantity: 0n,
    bulkSellQuantity: 0n,
    bulkNetQuantity: 0n,
    prevHighPrice: null,
    prevLowPrice: null,
    prevClose: null,
    ...overrides,
  };
}

describe("computeSignals", () => {
  it("returns zero score for inactive stock", () => {
    const m = makeMetric({ changePercent: 0, turnover: 0, closePosition: null });
    const score = computeSignals(m);
    expect(score.normalizedScore).toBe(0);
    expect(score.classification).toBe("D");
  });

  it("awards most active volume signal", () => {
    const m = makeMetric({ isMostActiveVolume: true, changePercent: 3, closePosition: 0.8 });
    const score = computeSignals(m);
    expect(score.activityVolumeScore).toBe(10);
    expect(score.signals.some((s) => s.key === "most_active_volume")).toBe(true);
  });

  it("awards most active value signal", () => {
    const m = makeMetric({ isMostActiveValue: true, changePercent: 3, closePosition: 0.8 });
    const score = computeSignals(m);
    expect(score.activityValueScore).toBe(10);
  });

  it("computes volume expansion score correctly", () => {
    expect(computeSignals(makeMetric({ volumeRatio1w: 0.5 })).volumeExpansionScore).toBe(0);
    expect(computeSignals(makeMetric({ volumeRatio1w: 1.2 })).volumeExpansionScore).toBe(3);
    expect(computeSignals(makeMetric({ volumeRatio1w: 1.8 })).volumeExpansionScore).toBe(6);
    expect(computeSignals(makeMetric({ volumeRatio1w: 2.5 })).volumeExpansionScore).toBe(10);
    expect(computeSignals(makeMetric({ volumeRatio1w: 4 })).volumeExpansionScore).toBe(14);
    expect(computeSignals(makeMetric({ volumeRatio1w: 7 })).volumeExpansionScore).toBe(17);
    expect(computeSignals(makeMetric({ volumeRatio1w: 15 })).volumeExpansionScore).toBe(20);
  });

  it("computes momentum score correctly", () => {
    expect(computeSignals(makeMetric({ changePercent: -1 })).momentumScore).toBe(0);
    expect(computeSignals(makeMetric({ changePercent: 0 })).momentumScore).toBe(0);
    expect(computeSignals(makeMetric({ changePercent: 1 })).momentumScore).toBe(3);
    expect(computeSignals(makeMetric({ changePercent: 3 })).momentumScore).toBe(7);
    expect(computeSignals(makeMetric({ changePercent: 6 })).momentumScore).toBe(10);
    expect(computeSignals(makeMetric({ changePercent: 10 })).momentumScore).toBe(7);
    expect(computeSignals(makeMetric({ changePercent: 15 })).momentumScore).toBe(3);
  });

  it("computes 52 week high score", () => {
    const score = computeSignals(makeMetric({ is52wHigh: true, isMostActiveVolume: true }));
    expect(score.week52Score).toBe(20); // 15 + 5 (strong volume)
  });

  it("computes 52 week high score without volume bonus", () => {
    const score = computeSignals(makeMetric({ is52wHigh: true, isMostActiveVolume: false }));
    expect(score.week52Score).toBe(15);
  });

  it("computes 52 week low score", () => {
    const score = computeSignals(makeMetric({ is52wLow: true, isTopLoser: true }));
    expect(score.week52Score).toBe(-20); // -15 + -5 (top loser)
  });

  it("computes 52 week low without top loser", () => {
    const score = computeSignals(makeMetric({ is52wLow: true, isTopLoser: false }));
    expect(score.week52Score).toBe(-15);
  });

  it("computes top gainer score", () => {
    const score = computeSignals(makeMetric({ isTopGainer: true }));
    expect(score.gainerScore).toBe(8);
  });

  it("computes top loser score", () => {
    const score = computeSignals(makeMetric({ isTopLoser: true }));
    expect(score.loserScore).toBe(-10);
  });

  it("awards strong price action score", () => {
    const score = computeSignals(makeMetric({ changePercent: 3, closePosition: 0.8 }));
    expect(score.priceActionScore).toBe(5);
  });

  it("penalizes weak close", () => {
    const score = computeSignals(makeMetric({ changePercent: 2, closePosition: 0.3 }));
    expect(score.riskPenalty).toBe(5);
    expect(score.priceActionScore).toBe(0);
  });

  it("no price action score when change <= 0", () => {
    const score = computeSignals(makeMetric({ changePercent: -1, closePosition: 0.9 }));
    expect(score.priceActionScore).toBe(0);
    expect(score.riskPenalty).toBe(0);
  });

  it("large deal net buy adds positive score", () => {
    const score = computeSignals(makeMetric({ bulkBuyQuantity: 100000n, bulkSellQuantity: 20000n, bulkNetQuantity: 80000n }));
    expect(score.largeDealScore).toBeGreaterThan(0);
  });

  it("large deal net sell adds negative score", () => {
    const score = computeSignals(makeMetric({ bulkBuyQuantity: 10000n, bulkSellQuantity: 100000n, bulkNetQuantity: -90000n }));
    expect(score.largeDealScore).toBeLessThan(0);
  });

  it("computes non-negative normalized score", () => {
    const m = makeMetric({
      isMostActiveVolume: true,
      isMostActiveValue: true,
      is52wHigh: true,
      isTopGainer: true,
      volumeRatio1w: 15,
      changePercent: 6,
      closePosition: 0.9,
      turnover: 10,
      bulkBuyQuantity: 100000n,
      bulkSellQuantity: 0n,
      bulkNetQuantity: 100000n,
    });
    const score = computeSignals(m);
    expect(score.normalizedScore).toBeGreaterThanOrEqual(0);
    expect(score.normalizedScore).toBeLessThanOrEqual(100);
    expect(["A_PLUS", "A", "B", "C", "D"]).toContain(score.classification);
  });

  it("warnings include 52w low notice", () => {
    const score = computeSignals(makeMetric({ is52wLow: true }));
    expect(score.warnings.some((w) => w.includes("52-week low"))).toBe(true);
  });
});
