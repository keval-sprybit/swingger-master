import { describe, it, expect } from "vitest";
import { runBacktest, BacktestSignal } from "../src/analysis/backtest.js";
import { PriceBar } from "../src/analysis/technical.js";

function bar(day: number, close: number, high?: number, low?: number): PriceBar {
  return {
    tradingDate: new Date(Date.UTC(2024, 0, day)),
    open: close, high: high ?? close, low: low ?? close, close, volume: 1000,
  };
}

function sig(overrides: Partial<BacktestSignal> = {}): BacktestSignal {
  return {
    signalDate: new Date("2024-01-01T00:00:00Z"),
    symbol: "TEST",
    mode: "SWING",
    classification: "A",
    score: 80,
    setupType: "BREAKOUT",
    marketCondition: "BULLISH",
    entry: 100,
    stop: 95,
    target1: 110,
    target2: 120,
    quantity: 100,
    ...overrides,
  };
}

describe("runBacktest", () => {
  it("records a WIN when target1 is hit before stop", () => {
    const bars = [bar(2, 104, 111, 103), bar(3, 106)];
    const { trades, metrics } = runBacktest([sig()], new Map([["TEST", bars]]));
    expect(trades[0].result).toBe("WIN");
    expect(trades[0].exitReason).toBe("TARGET1");
    expect(trades[0].exitPrice).toBe(110);
    expect(metrics.wins).toBe(1);
    expect(metrics.totalTrades).toBe(1);
    expect(metrics.winRate).toBe(100);
  });

  it("records a LOSS when stop is hit first", () => {
    const bars = [bar(2, 93, 98, 90)];
    const { trades, metrics } = runBacktest([sig()], new Map([["TEST", bars]]));
    expect(trades[0].result).toBe("LOSS");
    expect(trades[0].exitReason).toBe("STOP");
    expect(metrics.losses).toBe(1);
  });

  it("treats intrabar stop+target as conservative LOSS", () => {
    // single bar ranging from below stop to above target => stop assumed first
    const bars = [bar(2, 100, 115, 90)];
    const { trades } = runBacktest([sig()], new Map([["TEST", bars]]));
    expect(trades[0].result).toBe("LOSS");
  });

  it("marks OPEN when no bars follow the signal", () => {
    const { trades, metrics } = runBacktest([sig()], new Map([["TEST", []]]));
    expect(trades[0].result).toBe("OPEN");
    expect(metrics.open).toBe(1);
  });

  it("stops simulation after MAX_HOLDING_DAYS and closes at last close with TIME exit", () => {
    const bars = Array.from({ length: 30 }, (_, i) => bar(i + 2, 102));
    const { trades } = runBacktest([sig()], new Map([["TEST", bars]]));
    expect(trades[0].exitReason).toBe("TIME");
    expect((trades[0].holdingDays ?? 0)).toBeLessThanOrEqual(20);
  });

  it("computes MFE and MAE across the holding period", () => {
    const bars = [bar(2, 99, 103, 94), bar(3, 102, 112, 101), bar(4, 105)];
    const { trades } = runBacktest([sig()], new Map([["TEST", bars]]));
    const t = trades[0];
    expect(t.mfePct).toBeGreaterThan(0);
    expect(t.maePct).toBeGreaterThan(0);
  });
});