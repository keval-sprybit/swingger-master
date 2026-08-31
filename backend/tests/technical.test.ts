import { describe, it, expect } from "vitest";
import { computeIndicators, classifyTrend, PriceBar } from "../src/analysis/technical.js";

function makeBars(count: number, opts: { start?: number; step?: number; volume?: number; upTrend?: boolean } = {}): PriceBar[] {
  const { start = 100, step = 1, volume = 100000, upTrend = true } = opts;
  const bars: PriceBar[] = [];
  const base = new Date("2024-01-01T00:00:00Z");
  let price = start;
  for (let i = 0; i < count; i++) {
    const high = price + 2;
    const low = price - 2;
    bars.push({
      tradingDate: new Date(base.getTime() + i * 86400000),
      open: price - 0.5,
      high,
      low,
      close: price,
      volume,
    });
    price += upTrend ? step : -step;
  }
  // Ensure a real swing range so structure exists.
  return bars;
}

describe("computeIndicators", () => {
  it("returns INSUFFICIENT_DATA with too few bars", () => {
    const r = computeIndicators(makeBars(5));
    expect(r.available).toBe(false);
    expect(r.sma20).toBeNull();
    expect(r.rsi14).toBeNull();
    expect(r.atr14).toBeNull();
    expect(r.high20).toBeNull();
    expect(r.low20).toBeNull();
  });

  it("computes SMA20 exactly", () => {
    const bars = makeBars(25);
    const r = computeIndicators(bars);
    expect(r.sma20).not.toBeNull();
    const closes = bars.map((b) => b.close);
    const manual = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    expect(r.sma20).toBeCloseTo(manual, 6);
  });

  it("computes positive returns in an uptrend", () => {
    const r = computeIndicators(makeBars(30, { step: 1 }));
    expect(r.return1d).toBeGreaterThan(0);
    expect(r.return20d ?? 0).toBeGreaterThan(r.return1d ?? 0);
  });

  it("detects RSI ~100 when every day closers higher", () => {
    const r = computeIndicators(makeBars(30, { step: 1 }));
    expect(r.rsi14).toBe(100);
  });

  it("computes relative volume compared to 20-day average", () => {
    const bars = makeBars(25);
    const r = computeIndicators(bars);
    expect(r.avgVolume20).not.toBeNull();
    expect(r.relVolume).toBeCloseTo(1, 6); // all same volume
  });

  it("sets breakoutLevel to the prior swing high when above price", () => {
    const bars = makeBars(30, { step: 0.3 });
    // force a lower last close than the 5-day high so a level exists
    bars[bars.length - 1].close = bars[bars.length - 5].high - 5;
    bars[bars.length - 1].high = bars[bars.length - 5].high - 5;
    const r = computeIndicators(bars);
    const prior5 = bars.slice(-6, -1).reduce((m, b) => Math.max(m, b.high), 0);
    expect(r.breakoutLevel).not.toBeNull();
    expect(r.breakoutLevel).toBe(prior5);
    expect(r.breakoutReason).toBeTruthy();
  });

  it("classifies a clean uptrend with 20DMA>50DMA as STRONG_BULLISH", () => {
    const bars = makeBars(60, { step: 1 });
    const r = computeIndicators(bars);
    expect(r.trend).toBe("STRONG_BULLISH");
    expect(r.trendReasons.length).toBeGreaterThan(0);
    expect(r.sma20! > r.sma50!).toBe(true);
  });
});

describe("classifyTrend", () => {
  it("returns NEUTRAL when price between moving averages", () => {
    const { trend } = classifyTrend([100], 105, 95, null);
    expect(trend).toBe("NEUTRAL");
  });
  it("returns BULLISH when price above both SMAs", () => {
    const { trend, reasons } = classifyTrend([100], 99, 98, 105);
    expect(trend).toBe("BULLISH");
    expect(reasons).toContain("Price above 20 DMA");
  });
  it("returns STRONG_BEARISH when all factors negative", () => {
    const { trend } = classifyTrend([80], 85, 88, 90);
    expect(trend).toBe("STRONG_BEARISH");
  });
  it("returns null trend without any closes", () => {
    expect(classifyTrend([], null, null, null).trend).toBeNull();
  });
});