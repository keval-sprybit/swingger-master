import { describe, it, expect } from "vitest";
import { parseDate, detectDateFromFilename, toDateString } from "../src/utils/date.js";

describe("parseDate", () => {
  it("parses DD-Mon-YYYY", () => {
    const d = parseDate("27-Aug-2026");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(7); // August
    expect(d!.getDate()).toBe(27);
  });

  it("parses DD-Mon-YY", () => {
    const d = parseDate("27-Aug-26");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
  });

  it("parses YYYY-MM-DD", () => {
    const d = parseDate("2026-08-27");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(7);
    expect(d!.getDate()).toBe(27);
  });

  it("parses DD/MM/YYYY", () => {
    const d = parseDate("27/08/2026");
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(27);
  });

  it("handles Date objects", () => {
    const input = new Date(2026, 7, 27);
    const d = parseDate(input);
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(27);
  });

  it("returns null for invalid strings", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("not-a-date")).toBeNull();
    expect(parseDate(null)).toBeNull();
    expect(parseDate("32-Jan-2026")).toBeNull();
  });
});

describe("detectDateFromFilename", () => {
  it("extracts date from DD-Aug-YYYY pattern", () => {
    const d = detectDateFromFilename("MA-Equities-CM-volume-27-Aug-2026.csv");
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(27);
  });

  it("extracts date from YYYY-MM-DD pattern", () => {
    const d = detectDateFromFilename("report_2026-08-27.csv");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
  });

  it("returns null for filenames without dates", () => {
    expect(detectDateFromFilename("52WeekHigh.csv")).toBeNull();
    expect(detectDateFromFilename("data.csv")).toBeNull();
  });
});

describe("toDateString", () => {
  it("formats to YYYY-MM-DD", () => {
    const d = new Date(2026, 7, 27);
    expect(toDateString(d)).toBe("2026-08-27");
  });

  it("pads single digits", () => {
    const d = new Date(2026, 0, 5);
    expect(toDateString(d)).toBe("2026-01-05");
  });
});
