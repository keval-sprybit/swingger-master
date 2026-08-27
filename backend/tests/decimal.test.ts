import { describe, it, expect } from "vitest";
import { toDecimal, toBigInt, safeDiv } from "../src/utils/decimal.js";

describe("toDecimal", () => {
  it("parses numbers", () => {
    expect(toDecimal("123.45")?.toNumber()).toBe(123.45);
    expect(toDecimal(100)?.toNumber()).toBe(100);
  });

  it("returns null for empty/invalid", () => {
    expect(toDecimal(null)).toBeNull();
    expect(toDecimal(undefined)).toBeNull();
    expect(toDecimal("")).toBeNull();
    expect(toDecimal("NA")).toBeNull();
    expect(toDecimal("N/A")).toBeNull();
    expect(toDecimal("-")).toBeNull();
  });

  it("handles negative numbers", () => {
    expect(toDecimal("-5.5")?.toNumber()).toBe(-5.5);
  });
});

describe("toBigInt", () => {
  it("parses numeric strings", () => {
    expect(toBigInt("1000000")).toBe(1000000n);
    expect(toBigInt("1,234,567")).toBe(1234567n);
  });

  it("returns undefined for empty/invalid", () => {
    expect(toBigInt(null)).toBeUndefined();
    expect(toBigInt("")).toBeUndefined();
    expect(toBigInt("NA")).toBeUndefined();
  });

  it("truncates decimals", () => {
    expect(toBigInt("123.7")).toBe(123n);
  });
});

describe("safeDiv", () => {
  it("divides correctly", () => {
    expect(safeDiv(toDecimal(10), toDecimal(2))?.toNumber()).toBe(5);
  });

  it("returns null for zero denominator", () => {
    expect(safeDiv(toDecimal(10), toDecimal(0))).toBeNull();
  });

  it("returns null for null inputs", () => {
    expect(safeDiv(null, toDecimal(2))).toBeNull();
    expect(safeDiv(toDecimal(10), null)).toBeNull();
  });
});
