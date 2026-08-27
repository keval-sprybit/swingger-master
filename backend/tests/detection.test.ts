import { describe, it, expect } from "vitest";
import { normalizeHeader, detectReportType, buildColumnMap } from "../src/parsers/columns.js";
import { REPORT_SCHEMAS } from "../src/parsers/columns.js";

describe("normalizeHeader", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeHeader("VOLUME (Shares)")).toBe("volume shares");
    expect(normalizeHeader("PREV. CLOSE")).toBe("prev close");
    expect(normalizeHeader("%CHNG")).toBe("chng");
    expect(normalizeHeader("TODAY - % CHNG")).toBe("today chng");
    expect(normalizeHeader("TRADE PRICE / WEIGHTED AVG. PRICE")).toBe("trade price weighted avg price");
    expect(normalizeHeader("  OPEN  ")).toBe("open");
    expect(normalizeHeader("New 52W/H price")).toBe("new 52w h price");
    expect(normalizeHeader("1 WEEK - AVG. VOLUME")).toBe("1 week avg volume");
  });
});

describe("detectReportType", () => {
  it("detects Most Active Volume by headers", () => {
    const headers = ["SYMBOL", "OPEN", "HIGH", "LOW", "PREV. CLOSE", "LTP", "%CHNG", "VOLUME (Shares)", "VALUE", "CA"];
    const result = detectReportType(headers, "MA-Equities-CM-volume-27-Aug-2026.csv");
    expect(result.reportType).toBe("MOST_ACTIVE_VOLUME");
    expect(result.needsReview).toBe(false);
  });

  it("detects Most Active Value by headers + filename disambiguation", () => {
    const headers = ["SYMBOL", "OPEN", "HIGH", "LOW", "PREV. CLOSE", "LTP", "%CHNG", "VOLUME (Shares)", "VALUE", "CA"];
    const result = detectReportType(headers, "MA-Equities-CM-value-27-Aug-2026.csv");
    expect(result.reportType).toBe("MOST_ACTIVE_VALUE");
    expect(result.needsReview).toBe(false);
  });

  it("detects Volume Gainers", () => {
    const headers = ["SYMBOL", "SECURITY", "TODAY - VOLUME", "1 WEEK - AVG. VOLUME", "1 WEEK - CHANGE", "TODAY - LTP", "TODAY - % CHNG", "TODAY - TURNOVER"];
    const result = detectReportType(headers, "LA-Volume-Gainers-27-Aug-2026.csv");
    expect(result.reportType).toBe("VOLUME_GAINERS");
  });

  it("detects 52 Week High", () => {
    const headers = ["Symbol", "Series", "LTP", "%chng", "New 52W/H price", "Prev.High", "Prev. High Date"];
    const result = detectReportType(headers, "52WeekHigh.csv");
    expect(result.reportType).toBe("WEEK52_HIGH");
  });

  it("detects 52 Week Low", () => {
    const headers = ["Symbol", "Series", "LTP", "%chng", "New 52W/L price", "Prev.Low", "Prev. Low Date"];
    const result = detectReportType(headers, "52WeekLow.csv");
    expect(result.reportType).toBe("WEEK52_LOW");
  });

  it("detects Top Gainers by filename disambiguation", () => {
    const headers = ["Symbol", "Open", "High", "Low", "Prev. Close", "LTP", "%chng", "Volume", "Value", "CA"];
    const result = detectReportType(headers, "T20-GL-gainers-NIFTY-27-Aug-2026.csv");
    expect(result.reportType).toBe("TOP_GAINERS");
  });

  it("detects Top Losers by filename disambiguation", () => {
    const headers = ["Symbol", "Open", "High", "Low", "Prev. Close", "LTP", "%chng", "Volume", "Value", "CA"];
    const result = detectReportType(headers, "T20-GL-loosers-NIFTY-27-Aug-2026.csv");
    expect(result.reportType).toBe("TOP_LOSERS");
  });

  it("detects Large Deals", () => {
    const headers = ["DATE", "SYMBOL", "SECURITY NAME", "CLIENT NAME", "BUY/SELL", "QUANTITY TRADED", "TRADE PRICE / WEIGHTED AVG. PRICE", "REMARKS"];
    const result = detectReportType(headers, "Large-deals-BULK-27-Aug-2026.csv");
    expect(result.reportType).toBe("LARGE_DEALS");
  });

  it("returns NEEDS_REVIEW for unknown headers", () => {
    const headers = ["X", "Y", "Z"];
    const result = detectReportType(headers, "unknown.csv");
    expect(result.needsReview).toBe(true);
    expect(result.reportType).toBe("NEEDS_REVIEW");
  });
});

describe("buildColumnMap", () => {
  it("maps headers to canonical fields", () => {
    const schema = REPORT_SCHEMAS.find((s) => s.type === "MOST_ACTIVE_VOLUME")!;
    const headers = ["SYMBOL", "OPEN", "HIGH", "LOW", "PREV. CLOSE", "LTP", "%CHNG", "VOLUME (Shares)", "VALUE", "CA"];
    const map = buildColumnMap(schema, headers);
    expect(map.symbol).toBe("SYMBOL");
    expect(map.ltp).toBe("LTP");
    expect(map.prevClose).toBe("PREV. CLOSE");
    expect(map.volume).toBe("VOLUME (Shares)");
  });
});
