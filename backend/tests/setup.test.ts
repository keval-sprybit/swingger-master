import { describe, it, expect } from "vitest";
import { computeTradeSetup } from "../src/analysis/setup.js";
import { computeSignals } from "../src/analysis/signals.js";
import { MetricInput, SetupSettings } from "../src/analysis/types.js";

function makeMetric(overrides: Partial<MetricInput> = {}): MetricInput {
  return {
    stockId: 1, symbol: "TEST", ltp: 100, changePercent: 3, volume: 1000000n, turnover: 5,
    volumeRatio1w: 5, volumeRatio2w: null, closePosition: 0.8, dayRange: 5,
    previousClose: 97, highPrice: 102, lowPrice: 97, openPrice: 99,
    isMostActiveVolume: true, isMostActiveValue: false, isVolumeGainer: true,
    is52wHigh: true, is52wLow: false, isTopGainer: true, isTopLoser: false,
    bulkBuyQuantity: 0n, bulkSellQuantity: 0n, bulkNetQuantity: 0n,
    prevHighPrice: 101, prevLowPrice: 96, prevClose: 97,
    ...overrides,
  };
}

const settings: SetupSettings = { capital: 20000, riskPercent: 1, minRiskReward: 2 };

function getSetup(m: MetricInput) {
  const score = computeSignals(m);
  return computeTradeSetup(m, score, settings);
}

describe("computeTradeSetup", () => {
  it("returns INSUFFICIENT_DATA when ltp is null", () => {
    const s = getSetup(makeMetric({ ltp: null }));
    expect(s.status).toBe("INSUFFICIENT_DATA");
    expect(s.currentPrice).toBeNull();
  });

  it("returns INSUFFICIENT_DATA when no breakout level", () => {
    const s = getSetup(makeMetric({ prevHighPrice: null, highPrice: null }));
    expect(s.status).toBe("INSUFFICIENT_DATA");
  });

  it("returns INSUFFICIENT_DATA when no stop level", () => {
    const s = getSetup(makeMetric({ prevLowPrice: null, lowPrice: null }));
    expect(s.status).toBe("INSUFFICIENT_DATA");
  });

  it("returns AVOID when stop >= entry (gap-down scenario)", () => {
    const m = makeMetric({ prevHighPrice: null, highPrice: 100, prevLowPrice: 102, lowPrice: 98, ltp: 99, dayRange: 0.1, is52wLow: false });
    const s = getSetup(m);
    expect(s.status).toBe("AVOID");
  });

  it("returns AVOID for 52 week low", () => {
    const score = computeSignals(makeMetric({ is52wLow: true, changePercent: -5, closePosition: 0.1 }));
    const s = computeTradeSetup(makeMetric({ is52wLow: true, changePercent: -5, closePosition: 0.1 }), score, settings);
    expect(s.status).toBe("AVOID");
  });

  it("returns WAIT_FOR_BREAKOUT when price below breakout", () => {
    const m = makeMetric({ ltp: 98, prevHighPrice: 101, highPrice: 100, prevLowPrice: 96, lowPrice: 95 });
    const s = getSetup(m);
    expect(s.status).toBe("WAIT_FOR_BREAKOUT");
  });

  it("returns CHASE_RISK when price extended above breakout", () => {
    const m = makeMetric({ ltp: 105, prevHighPrice: 101, highPrice: 102, prevLowPrice: 96, lowPrice: 95 });
    const s = getSetup(m);
    expect(s.status).toBe("CHASE_RISK");
  });

  it("returns BUY_SETUP for strong candidate with confirmed breakout", () => {
    const m = makeMetric({ ltp: 101.5, prevHighPrice: 101, prevLowPrice: 96 });
    const s = getSetup(m);
    expect(s.status).toBe("BUY_SETUP");
    expect(s.entryLow).toBeGreaterThan(0);
    expect(s.stopLoss).toBeLessThan(s.entryLow!);
    expect(s.riskReward1).toBeGreaterThanOrEqual(settings.minRiskReward);
  });

  it("computes position sizing correctly", () => {
    const m = makeMetric({ ltp: 101.5, prevHighPrice: 101, prevLowPrice: 96 });
    const s = getSetup(m);
    expect(s.recommendedQuantity).toBeGreaterThan(0);
    expect(s.maximumRisk).toBe(200); // 20000 * 1% / 100 = 200
    expect(s.capitalUsed).toBeLessThanOrEqual(settings.capital);
    expect(s.maximumLoss).toBeLessThanOrEqual(s.maximumRisk);
  });

  it("sets trigger and invalidation conditions", () => {
    const m = makeMetric({ ltp: 101.5, prevHighPrice: 101, prevLowPrice: 96 });
    const s = getSetup(m);
    expect(s.triggerCondition).toContain("break");
    expect(s.invalidationCondition).toContain("closes below");
  });

  it("produces valid entry zone (entryLow < entryHigh)", () => {
    const m = makeMetric({ ltp: 101.5, prevHighPrice: 101, prevLowPrice: 96 });
    const s = getSetup(m);
    expect(s.entryLow).toBeLessThan(s.entryHigh!);
  });

  it("target1 >= entry + minRR * risk", () => {
    const m = makeMetric({ ltp: 101.5, prevHighPrice: 101, prevLowPrice: 96 });
    const s = getSetup(m);
    const minTarget = s.entryLow! + settings.minRiskReward * s.riskPerShare!;
    expect(s.target1).toBeGreaterThanOrEqual(minTarget - 0.001);
  });

  it("uses today's high when no previous day data", () => {
    const m = makeMetric({ prevHighPrice: null, prevLowPrice: null, highPrice: 102, lowPrice: 97, ltp: 100 });
    const s = getSetup(m);
    expect(s.breakoutLevel).toBe(102);
    expect(s.stopLoss).toBeLessThan(s.entryLow!);
  });
});
