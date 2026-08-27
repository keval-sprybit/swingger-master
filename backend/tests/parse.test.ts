import { describe, it, expect } from "vitest";
import { detectAndParse } from "../src/parsers/index.js";

function csvBuffer(header: string, rows: string[][]): Buffer {
  const lines = [header, ...rows.map((r) => r.join(","))];
  return Buffer.from(lines.join("\n"), "utf8");
}

describe("detectAndParse - Most Active Volume", () => {
  const buf = csvBuffer(
    "SYMBOL,OPEN,HIGH,LOW,PREV. CLOSE,LTP,%CHNG,VOLUME (Shares),VALUE,CA",
    [
      ["RELIANCE", "2800", "2850", "2790", "2780", "2845", "2.34", "5000000", "1400000", ""],
      ["TCS", "3500", "3550", "3490", "3480", "3540", "1.72", "3000000", "1050000", ""],
    ]
  );

  it("detects report type and parses rows", () => {
    const result = detectAndParse(buf, "MA-Equities-CM-volume-27-Aug-2026.csv");
    expect(result.reportType).toBe("MOST_ACTIVE_VOLUME");
    expect(result.needsReview).toBe(false);
    expect(result.validRows).toBe(2);
    expect(result.invalidRows).toBe(0);
    expect(result.rows[0].symbol).toBe("RELIANCE");
    expect(result.rows[0].ltp).toBe(2845);
    expect(result.rows[0].volume).toBe(5000000n);
    expect(result.rows[1].changePercent).toBe(1.72);
  });
});

describe("detectAndParse - Volume Gainers", () => {
  const buf = csvBuffer(
    "SYMBOL,SECURITY,TODAY - VOLUME,1 WEEK - AVG. VOLUME,1 WEEK - CHANGE,2 WEEK - AVG. VOLUME,2 WEEK - CHANGE,TODAY - LTP,TODAY - % CHNG,TODAY - TURNOVER",
    [
      ["BBTC", "BOMBAY BURMAH TRADING CORPN LTD", "5000000", "50000", "100.0", "55000", "90.9", "150", "13.5", "750000"],
    ]
  );

  it("detects and normalizes volume gainers with ratios", () => {
    const result = detectAndParse(buf, "LA-Volume-Gainers-27-Aug-2026.csv");
    expect(result.reportType).toBe("VOLUME_GAINERS");
    expect(result.validRows).toBe(1);
    const r = result.rows[0];
    expect(r.symbol).toBe("BBTC");
    expect(r.security).toBe("BOMBAY BURMAH TRADING CORPN LTD");
    expect(r.todayVolume).toBe(5000000n);
    expect(r.avgVolume1w).toBe(50000n);
    expect(r.volumeRatio1w).toBeCloseTo(100);
    expect(r.volumeRatio2w).toBeCloseTo(90.909);
    expect(r.todayLtp).toBe(150);
  });
});

describe("detectAndParse - 52 Week High", () => {
  const buf = csvBuffer(
    "Symbol,Series,LTP,%chng,New 52W/H price,Prev.High,Prev. High Date",
    [
      ["HDFCBANK", "EQ", "1750", "1.2", "1755", "1740", "15-Jul-2025"],
    ]
  );

  it("detects and parses 52 week high", () => {
    const result = detectAndParse(buf, "52WeekHigh.csv");
    expect(result.reportType).toBe("WEEK52_HIGH");
    expect(result.rows[0].new52wHigh).toBe(1755);
    expect(result.rows[0].previousHigh).toBe(1740);
  });
});

describe("detectAndParse - Large Deals", () => {
  const buf = csvBuffer(
    "DATE,SYMBOL,SECURITY NAME,CLIENT NAME,BUY/SELL,QUANTITY TRADED,TRADE PRICE / WEIGHTED AVG. PRICE,REMARKS",
    [
      ["27-Aug-2026", "RELIANCE", "RELIANCE INDUSTRIES LTD", "ABC FUND", "BUY", "100000", "2845", ""],
    ]
  );

  it("detects large deals and parses trade", () => {
    const result = detectAndParse(buf, "Large-deals-BULK-27-Aug-2026.csv");
    expect(result.reportType).toBe("LARGE_DEALS");
    expect(result.rows[0].buySell).toBe("BUY");
    expect(result.rows[0].quantityTraded).toBe(100000n);
    expect(result.rows[0].tradePrice).toBe(2845);
    expect(result.rows[0].clientName).toBe("ABC FUND");
    expect(result.rows[0].tradeDate).not.toBeNull();
  });
});

describe("detectAndParse - Needs Review", () => {
  const buf = csvBuffer("X,Y,Z", [["1", "2", "3"]]);
  it("returns needsReview for unknown headers", () => {
    const result = detectAndParse(buf, "mystery.csv");
    expect(result.needsReview).toBe(true);
    expect(result.invalidRows).toBe(1);
  });
});

describe("detectAndParse - Date detection from filename", () => {
  it("extracts date from filename", () => {
    const buf = csvBuffer("SYMBOL,LTP,PREV. CLOSE,%CHNG,VOLUME,VALUE", [["RELIANCE", "2845", "2780", "2.34", "5000000", "1400000"]]);
    const result = detectAndParse(buf, "Top20-Gainers-27-Aug-2026.csv");
    expect(result.filenameDate).not.toBeNull();
    expect(result.filenameDate!.getDate()).toBe(27);
  });
});
