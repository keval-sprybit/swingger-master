import { describe, it, expect } from "vitest";
import { computeStructure } from "../src/analysis/structure.js";
import { computeIndicators, TechnicalIndicators } from "../src/analysis/technical.js";
import { computeExplainableScore } from "../src/analysis/scoring.js";
import { MetricInput, ScoreResult, SetupSettings } from "../src/analysis/types.js";

const settings: SetupSettings = { capital: 20000, riskPercent: 1, minRiskReward: 2 };

function makeScore(classification: ScoreResult["classification"] = "A"): ScoreResult {
  const n = { A_PLUS: 90, A: 78, B: 65, C: 50, D: 35 }[classification];
  return {
    activityVolumeScore: 0, activityValueScore: 0, volumeExpansionScore: 0,
    momentumScore: 0, week52Score: 0, gainerScore: 0, loserScore: 0,
    liquidityScore: 0, largeDealScore: 0, priceActionScore: 0, riskPenalty: 0,
    rawScore: n, normalizedScore: n, classification,
    signals: [{ key: "x", label: "X", points: 2, source: "test" }],
    warnings: [],
  };
}

function makeMetric(overrides: Partial<MetricInput> = {}): MetricInput {
  return {
    stockId: 1, symbol: "TEST", ltp: 100, changePercent: 3, volume: 1000000n, turnover: 5,
    volumeRatio1w: 5, volumeRatio2w: null, closePosition: 0.8, dayRange: 5,
    previousClose: 97, highPrice: 102, lowPrice: 97, openPrice: 99,
    isMostActiveVolume: true, isMostActiveValue: false, isVolumeGainer: true,
    is52wHigh: false, is52wLow: false, isTopGainer: true, isTopLoser: false,
    bulkBuyQuantity: 0n, bulkSellQuantity: 0n, bulkNetQuantity: 0n,
    prevHighPrice: 101, prevLowPrice: 96, prevClose: 97,
    ...overrides,
  };
}

function makeTech(close: number): ReturnType<typeof computeIndicators> {
  const bars: PriceBar[] = [];
  const start = new Date("2024-01-01T00:00:00Z");
  for (let i = 0; i < 60; i++) {
    const p = 100 + i * 0.5;
    bars.push({
      tradingDate: new Date(start.getTime() + i * 86400000),
      open: p - 0.5, high: p + 1.5, low: p - 2, close: p, volume: 200000,
    });
  }
  // set last close/high/low
  const last = bars[bars.length - 1];
  last.close = close;
  last.high = close + 2;
  last.low = close - 3;
  return computeIndicators(bars);
}

// Hand-built technical context so tests control the exact breakout geometry.
function fakeTech(overrides: Partial<TechnicalIndicators> = {}): TechnicalIndicators {
  const base: TechnicalIndicators = {
    available: true, availableDays: 200,
    sma20: 99, sma50: 97, sma200: 90,
    rsi14: 62, atr14: 2, relVolume: 2, avgVolume20: 200000,
    return1d: 1.5, return5d: 4, return10d: 7, return20d: 12,
    high20: 101.2, low20: 98, high50: 103, low50: 96,
    structure: {
      recent: { swingHigh: 101.5, swingHighDaysAgo: 2, swingLow: 100.5, swingLowDaysAgo: 1 },
      last20: { swingHigh: 101.2, swingHighDaysAgo: 6, swingLow: 99, swingLowDaysAgo: 12 },
      last50: { swingHigh: 103, swingHighDaysAgo: 3, swingLow: 96, swingLowDaysAgo: 40 },
    },
    supportResistance: { support: null, resistance: null },
    breakoutLevel: 101, breakoutReason: "Previous day high",
    trend: "BULLISH", trendReasons: ["Price above 20 DMA", "20 DMA above 50 DMA"],
  };
  return { ...base, ...overrides };
}

function getStructure(overrides: { metric?: Partial<MetricInput>; score?: ScoreResult; mode?: "INTRADAY" | "SWING"; marketCondition?: "BULLISH" | "NEUTRAL" | "BEARISH" | null; tech?: ReturnType<typeof computeIndicators> | null } = {}) {
  const metric = makeMetric(overrides.metric);
  const tech = overrides.tech !== undefined ? overrides.tech : makeTech(metric.ltp ?? 100);
  const score = overrides.score ?? makeScore();
  const mode = overrides.mode ?? "SWING";
  const marketCondition = overrides.marketCondition !== undefined ? overrides.marketCondition : "BULLISH";
  return computeStructure({ metric, score, tech, marketCondition, mode, settings });
}

describe("computeStructure", () => {
  it("returns INSUFFICIENT_DATA when ltp is null", () => {
    const s = getStructure({ metric: { ltp: null } });
    expect(s.status).toBe("INSUFFICIENT_DATA");
    expect(s.currentPrice).toBeNull();
  });

  it("estimates breakout from structure when ltp sits below prior high", () => {
    // ltp below the 60-bar rising structure's recent highs
    const s = getStructure({ metric: { ltp: 118 } });
    expect(s.breakoutLevel).not.toBeNull();
    expect(s.breakoutReason).toBeTruthy();
    expect(s.status).toContain("WAIT");
  });

  it("flags AVOID on a new 52-week low", () => {
    const s = getStructure({ metric: { is52wLow: true, changePercent: -5, closePosition: 0.1 }, score: makeScore("D") });
    expect(s.status).toBe("AVOID");
    expect(s.whySelected.join(" ").toLowerCase()).toContain("low");
  });

  it("AVOID when D classification with poor RR", () => {
    // construct scenario where rr1 < 1 (very tight stop -> huge risk per share)
    const s = getStructure({
      score: makeScore("D"),
      metric: { ltp: 200, prevHighPrice: 200.1, prevLowPrice: 190, lowPrice: 195 },
    });
    // entry must be very near stop to produce rr<1; force via far target
    expect(["AVOID", "NO_TRADE"]).toContain(s.status);
  });

  it("produces ENTRY ACTIVE for a confirmed breakout with volume", () => {
    const tech = fakeTech(); // breakoutLevel 101, recent swingLow 100.5, relVolume 2
    const s = getStructure({ metric: { ltp: 101.5, closePosition: 0.9, prevHighPrice: 101 }, tech });
    expect(s.status).toBe("ENTRY_ACTIVE");
    expect(s.breakoutLevel).toBe(101);
    expect(s.entryLow).toBeGreaterThan(s.breakoutLevel!);
    expect(s.stopLoss).toBeLessThan(s.entryLow!);
    expect(s.recommendedQuantity).toBeGreaterThan(0);
    expect(s.breakoutStatus).toBe("BREAKOUT CONFIRMED");
  });

  it("stays BREAKOUT CONFIRMED (not ENTRY ACTIVE) without volume confirmation", () => {
    const tech = fakeTech({ relVolume: 1.0 });
    const s = getStructure({ metric: { ltp: 101.5, closePosition: 0.9, prevHighPrice: 101 }, tech });
    expect(["BREAKOUT_CONFIRMED", "WEAK_BREAKOUT"]).toContain(s.status);
    expect(s.status).not.toBe("ENTRY_ACTIVE");
  });

  it("MISSED when price extended far above the entry zone", () => {
    const tech = fakeTech();
    const s = getStructure({ metric: { ltp: 108, prevHighPrice: 101 }, tech });
    expect(s.status).toBe("MISSED");
    expect(s.reason?.toLowerCase()).toContain("chase");
  });

  it("WEAK BREAKOUT when risk/reward is below minimum despite break", () => {
    // stop far below (recent swingLow 99) and target capped by nearby resistance
    const tech = fakeTech({
      structure: { ...fakeTech().structure, recent: { swingHigh: 101.5, swingHighDaysAgo: 1, swingLow: 99, swingLowDaysAgo: 1 } },
      supportResistance: { support: { level: 98, reason: "20-day low (structural support)" }, resistance: { level: 105, reason: "50-day high (structural resistance)" } },
    });
    const s = getStructure({ metric: { ltp: 102, prevHighPrice: 101 }, tech });
    expect(s.riskReward1 ?? 99).toBeLessThan(2);
    expect(s.status).toBe("WEAK_BREAKOUT");
  });

  it("computes risk-based position sizing within capital", () => {
    const s = getStructure();
    expect(s.recommendedQuantity).toBeGreaterThan(0);
    expect(s.maximumRisk).toBe(200); // 20000 * 1%
    expect(s.capitalUsed ?? 0).toBeLessThanOrEqual(settings.capital);
    expect(s.maximumLoss ?? 0).toBeLessThanOrEqual(s.maximumRisk);
    expect(s.riskReward1).not.toBeNull();
    expect(s.breakoutStatus).toBeTruthy();
    expect(s.reason).toBeTruthy();
  });

  it("declares insufficientData when tech unavailable but still computes", () => {
    const s = getStructure({ tech: null });
    expect(s.status).not.toBe("");
  });

  it("produces explainable why bullets", () => {
    const s = getStructure();
    expect(s.whySelected.length).toBeGreaterThan(0);
  });
});

describe("computeExplainableScore", () => {
  it("scores differently for INTRADAY vs SWING for the same stock", () => {
    const metric = makeMetric();
    const tech = makeTech(metric.ltp ?? 100);
    const setup = getStructure();
    const intraday = computeExplainableScore({ mode: "INTRADAY", metric, tech, marketCondition: "BULLISH", setup });
    const swing = computeExplainableScore({ mode: "SWING", metric, tech, marketCondition: "BULLISH", setup });
    expect(intraday.components.map((c) => c.key)).not.toEqual(swing.components.map((c) => c.key));
    expect(intraday.total).toBeGreaterThanOrEqual(0);
    expect(intraday.total).toBeLessThanOrEqual(100);
  });

  it("reports warnings from metric flags", () => {
    const metric = makeMetric({ is52wLow: true, changePercent: -12, ltp: 8 });
    const res = computeExplainableScore({ mode: "SWING", metric, tech: null, marketCondition: "NEUTRAL", setup: null });
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.warnings.some((w) => w.toLowerCase().includes("52-week") || w.toLowerCase().includes("low"))).toBe(true);
  });

  it("handles missing technical data gracefully", () => {
    const metric = makeMetric();
    const res = computeExplainableScore({ mode: "SWING", metric, tech: null, marketCondition: null, setup: null, dataQuality: 0.3 });
    expect(res.total).toBeGreaterThanOrEqual(0);
    expect(res.warnings.some((w) => w.toLowerCase().includes("history") || w.toLowerCase().includes("data"))).toBe(true);
  });
});