// Convert Prisma result objects into plain JSON-safe structures.
// Prisma returns Decimal.js instances and BigInt; express JSON.stringify cannot
// serialize BigInt, and Decimal serializes to a string which is awkward for charts.
export function toPlain(value) {
    if (value === null || value === undefined)
        return value;
    if (typeof value === "bigint") {
        const n = Number(value);
        return (Number.isSafeInteger(n) ? n : value.toString());
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "string")
        return value;
    if (value instanceof Date)
        return value.toISOString();
    // Prisma / decimal.js Decimal — has toNumber() and internal {s, e, d} structure
    if (value && typeof value === "object" && typeof value.toNumber === "function" && "d" in value && "e" in value) {
        const n = value.toNumber();
        return (Number.isFinite(n) ? n : value.toString());
    }
    if (Array.isArray(value))
        return value.map((v) => toPlain(v));
    if (typeof value === "object") {
        const out = {};
        for (const k of Object.keys(value)) {
            out[k] = toPlain(value[k]);
        }
        return out;
    }
    return value;
}
//# sourceMappingURL=serialize.js.map