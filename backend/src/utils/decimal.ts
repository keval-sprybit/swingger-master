import Decimal from "decimal.js";

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export function toDecimal(value: unknown): Decimal | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Decimal) return value;
  if (typeof value === "bigint") return new Decimal(value.toString());
  if (value instanceof Date) return null;
  const s = typeof value === "string" ? value.trim() : String(value);
  if (s === "" || s === "-" || s === "null" || s === "NULL" || s === "NA" || s === "N/A") return null;
  try {
    const d = new Decimal(s);
    return d.isNaN() ? null : d;
  } catch {
    return null;
  }
}

export function d(value: unknown, fallback = 0): Decimal {
  return toDecimal(value) ?? new Decimal(fallback);
}

export function toBigInt(value: unknown): bigint | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "bigint") return value;
  const s = typeof value === "string" ? value.trim() : String(value);
  if (s === "" || s === "null" || s === "NULL" || s === "NA" || s === "N/A") return undefined;
  const cleaned = s.replace(/[, ]/g, "");
  try {
    return BigInt(cleaned);
  } catch {
    const n = Number(cleaned);
    return Number.isFinite(n) ? BigInt(Math.trunc(n)) : undefined;
  }
}

export function safeDiv(numerator: Decimal | null, denominator: Decimal | null): Decimal | null {
  if (!numerator || !denominator || denominator.isZero()) return null;
  return numerator.div(denominator);
}
