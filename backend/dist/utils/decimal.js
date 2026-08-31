import Decimal from "decimal.js";
Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });
export { Decimal };
export function toDecimal(value) {
    if (value === null || value === undefined)
        return null;
    if (value instanceof Decimal)
        return value;
    if (typeof value === "bigint")
        return new Decimal(value.toString());
    if (value instanceof Date)
        return null;
    const s = typeof value === "string" ? value.trim() : String(value);
    if (s === "" || s === "-" || s === "null" || s === "NULL" || s === "NA" || s === "N/A")
        return null;
    try {
        const d = new Decimal(s);
        return d.isNaN() ? null : d;
    }
    catch {
        return null;
    }
}
export function d(value, fallback = 0) {
    return toDecimal(value) ?? new Decimal(fallback);
}
export function toBigInt(value) {
    if (value === null || value === undefined)
        return undefined;
    if (typeof value === "bigint")
        return value;
    const s = typeof value === "string" ? value.trim() : String(value);
    if (s === "" || s === "null" || s === "NULL" || s === "NA" || s === "N/A")
        return undefined;
    const cleaned = s.replace(/[, ]/g, "");
    try {
        return BigInt(cleaned);
    }
    catch {
        const n = Number(cleaned);
        return Number.isFinite(n) ? BigInt(Math.trunc(n)) : undefined;
    }
}
export function safeDiv(numerator, denominator) {
    if (!numerator || !denominator || denominator.isZero())
        return null;
    return numerator.div(denominator);
}
//# sourceMappingURL=decimal.js.map