import { describe, it, expect } from "vitest";
import { detectAndParse } from "../src/parsers/index.js";
import { detectTradingDate } from "../src/parsers/columns.js";

function csvBuffer(header: string, rows: string[][]): Buffer {
  const lines = [header, ...rows.map((r) => r.join(","))];
  return Buffer.from(lines.join("\n"), "utf8");
}

describe("Bulk Deals: report date vs row-level deal date", () => {
  const header = "DATE,SYMBOL,SECURITY NAME,CLIENT NAME,BUY/SELL,QUANTITY TRADED,TRADE PRICE / WEIGHTED AVG. PRICE,REMARKS";
  const filename = "Large-deals-BULK-27-Aug-2026.csv";

  const rowsWithOlderDealDate = [
    ["26-Aug-2026", "RELIANCE", "RELIANCE INDUSTRIES LTD", "ABC FUND", "BUY", "100000", "2845", ""],
    ["26-Aug-2026", "TCS", "TATA CONSULTANCY SVCS", "XYZ FUND", "SELL", "50000", "3540", ""],
  ];

  it("uses the filename date as the report/trading date, not the row DATE column", () => {
    const result = detectAndParse(csvBuffer(header, rowsWithOlderDealDate), filename);
    expect(result.reportType).toBe("LARGE_DEALS");
    // Report/trading date must be 27-Aug-2026 (from filename), NOT the row's 26-Aug.
    expect(result.detectedDate).not.toBeNull();
    expect(result.detectedDate!.getDate()).toBe(27);
    expect(result.detectedDate!.getMonth()).toBe(7); // August
    expect(result.detectedDate!.getFullYear()).toBe(2026);
    expect(result.dateSource).toBe("filename");
  });

  it("preserves the row-level deal date as tradeDate", () => {
    const result = detectAndParse(csvBuffer(header, rowsWithOlderDealDate), filename);
    expect(result.rows).toHaveLength(2);
    for (const r of result.rows) {
      expect(r.tradeDate).not.toBeNull();
      expect(r.tradeDate!.getDate()).toBe(26); // row-level deal date preserved
      expect(r.tradeDate!.getMonth()).toBe(7);
      expect(r.tradeDate!.getFullYear()).toBe(2026);
    }
  });

  it("flags that row-level deal dates differ from the report date", () => {
    const result = detectAndParse(csvBuffer(header, rowsWithOlderDealDate), filename);
    expect(result.dealDatesDetected).toBe(true);
  });

  it("does not flag dealDatesDetected when row dates match the report date", () => {
    const matching = [
      ["27-Aug-2026", "RELIANCE", "RELIANCE INDUSTRIES LTD", "ABC FUND", "BUY", "100000", "2845", ""],
    ];
    const result = detectAndParse(csvBuffer(header, matching), filename);
    expect(result.dealDatesDetected).toBe(false);
  });

  it("exposes filenameDate separately from the report trading date", () => {
    const result = detectAndParse(csvBuffer(header, rowsWithOlderDealDate), filename);
    expect(result.filenameDate).not.toBeNull();
    expect(result.filenameDate!.getDate()).toBe(27);
    // For LARGE_DEALS, detectedDate equals the filename date.
    expect(result.detectedDate!.getTime()).toBe(result.filenameDate!.getTime());
  });
});

describe("detectTradingDate - Large Deals prefers filename over row DATE", () => {
  const header = "DATE,SYMBOL,SECURITY NAME,CLIENT NAME,BUY/SELL,QUANTITY TRADED,TRADE PRICE / WEIGHTED AVG. PRICE,REMARKS";
  const rows = [
    ["26-Aug-2026", "RELIANCE", "RELIANCE INDUSTRIES LTD", "ABC FUND", "BUY", "100000", "2845", ""],
  ];

  it("returns the filename (report) date for LARGE_DEALS even when a DATE column exists", () => {
    const info = detectTradingDate(header.split(","), rows, "Large-deals-BULK-27-Aug-2026.csv", "LARGE_DEALS");
    expect(info.source).toBe("filename");
    expect(info.detectedDate!.getDate()).toBe(27);
  });

  it("still uses a content DATE column for non-deal report types", () => {
    const headers = ["DATE", "SYMBOL", "VALUE"];
    const r = [{ DATE: "2026-08-15", SYMBOL: "TCS", VALUE: "100" }];
    const info = detectTradingDate(headers, r, "report.csv", "TOP_GAINERS");
    expect(info.source).toBe("content");
    expect(info.detectedDate!.getDate()).toBe(15);
  });
});
