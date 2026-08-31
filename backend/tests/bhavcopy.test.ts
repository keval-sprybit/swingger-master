import { describe, it, expect } from "vitest";
import { detectAndParse } from "../src/parsers/index.js";
import { isEquitySeries } from "../src/repositories/reports.js";

// Sample representing the CM-UDiFF Bhavcopy format:
// TradDt,TckrSymb,ISIN,SctySrs,OpnPric,HghPric,LwPric,ClsPric,LastPric,PrvsClsgPric,TtlTradgVol,TtlTrfVal,TtlNbOfTxsExctd
const CM_UDIFF_HEADERS =
  "TradDt,TckrSymb,ISIN,SctySrs,OpnPric,HghPric,LwPric,ClsPric,LastPric,PrvsClsgPric,TtlTradgVol,TtlTrfVal,TtlNbOfTxsExctd";
const CM_UDIFF_ROW =
  "2026-08-28,RELIANCE,INE002A01018,EQ,3050.00,3060.00,3040.00,3055.00,3055.00,3045.00,1234567,3765000000,95000";

function makeCsv(headers: string, rows: string[]): Buffer {
  return Buffer.from([headers, ...rows].join("\n"), "utf8");
}

describe("CM-UDiFF Bhavcopy detection + parse", () => {
  it("detects the CM-UDiFF Bhavcopy from headers", () => {
    const buf = makeCsv(CM_UDIFF_HEADERS, [CM_UDIFF_ROW, CM_UDIFF_ROW]);
    const parsed = detectAndParse(buf, "BhavCopy_NSE_CM_0_0_0_20260828_F_0000.csv");
    expect(parsed.needsReview).toBe(false);
    expect(parsed.reportType).toBe("BHAVCOPY");
    expect(parsed.validRows).toBe(2);
  });

  it("detects the trading date from the TradDt column", () => {
    const buf = makeCsv(CM_UDIFF_HEADERS, [CM_UDIFF_ROW]);
    const parsed = detectAndParse(buf, "BhavCopy_NSE_CM_0_0_0_20260828_F_0000.csv");
    expect(parsed.detectedDate).not.toBeNull();
    const d = parsed.detectedDate!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(28);
    expect(parsed.dateSource).toBe("content");
  });

  it("normalizes OHLC, volume, turnover and trades from CM-UDiFF columns", () => {
    const buf = makeCsv(CM_UDIFF_HEADERS, [CM_UDIFF_ROW]);
    const parsed = detectAndParse(buf, "BhavCopy_NSE_CM_0_0_0_20260828_F_0000.csv");
    const row = parsed.rows[0];
    expect(row.symbol).toBe("RELIANCE");
    expect(row.series).toBe("EQ");
    expect(row.isin).toBe("INE002A01018");
    expect(row.openPrice).toBe(3050);
    expect(row.highPrice).toBe(3060);
    expect(row.lowPrice).toBe(3040);
    expect(row.closePrice).toBe(3055);
    expect(row.lastPrice).toBe(3055);
    expect(row.previousClose).toBe(3045);
    expect(Number(row.volume)).toBe(1234567);
    expect(row.turnover).toBe(3765000000);
    expect(row.trades).toBe(95000);
  });

  it("computed changePercent from prev close to close", () => {
    const buf = makeCsv(CM_UDIFF_HEADERS, [CM_UDIFF_ROW]);
    const parsed = detectAndParse(buf, "BhavCopy_NSE_CM_0_0_0_20260828_F_0000.csv");
    const row = parsed.rows[0];
    expect(row.changePercent).toBeCloseTo(((3055 - 3045) / 3045) * 100, 5);
  });
});

describe("Standard NSE bhavcopy detection (compact headers)", () => {
  it("detects SYMBOL/SERIES/OPEN/.../TOTTRDQTY/TOTTRDVAL/TIMESTAMP", () => {
    const headers = ["SYMBOL","SERIES","OPEN","HIGH","LOW","CLOSE","LAST","PREVCLOSE","TOTTRDQTY","TOTTRDVAL","TIMESTAMP","TOTALTRADES","ISIN"];
    const row = ["RELIANCE","EQ","3050","3060","3040","3055","3055","3045","1234567","3765000000","28-Aug-2026","95000","INE002A01018"];
    const buf = makeCsv(headers.join(","), [row.join(",")]);
    const parsed = detectAndParse(buf, "cm28AUG2026bhav.csv");
    expect(parsed.needsReview).toBe(false);
    expect(parsed.reportType).toBe("BHAVCOPY");
    const r = parsed.rows[0];
    expect(r.symbol).toBe("RELIANCE");
    expect(Number(r.volume)).toBe(1234567);
  });
});

describe("Bhavcopy equity / security-series filtering", () => {
  it("treats EQ and BE as normal equity securities", () => {
    expect(isEquitySeries("EQ")).toBe(true);
    expect(isEquitySeries("BE")).toBe(true);
    expect(isEquitySeries("eq")).toBe(true);
    expect(isEquitySeries(null)).toBe(true); // unlabelled rows default to EQ
  });

  it("excludes non-equity series (SME, futures, ETFs, bonds, warrants)", () => {
    // SME / small-cap
    expect(isEquitySeries("SM")).toBe(false);
    // futures segments
    for (const s of ["N0", "N5", "NF", "NQ"]) expect(isEquitySeries(s)).toBe(false);
    // ETFs / index issues / bonds / warrants
    for (const s of ["IV", "RR", "GB", "TB", "ZL", "SG"]) expect(isEquitySeries(s)).toBe(false);
    // restricted/odd segments
    expect(isEquitySeries("BZ")).toBe(false);
  });
});

