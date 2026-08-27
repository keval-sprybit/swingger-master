// Convert Prisma result objects into plain JSON-safe structures.
// Prisma returns Decimal.js instances and BigInt; express JSON.stringify cannot
// serialize BigInt, and Decimal serializes to a string which is awkward for charts.
export function toPlain<T = any>(value: any): T {
  if (value === null || value === undefined) return value as any;
  if (typeof value === "bigint") {
    const n = Number(value);
    return (Number.isSafeInteger(n) ? n : value.toString()) as any;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") return value as any;
  if (value instanceof Date) return value.toISOString() as any;
  // Prisma / decimal.js Decimal — has toNumber() and internal {s, e, d} structure
  if (value && typeof value === "object" && typeof (value as any).toNumber === "function" && "d" in value && "e" in value) {
    const n = (value as any).toNumber();
    return (Number.isFinite(n) ? n : (value as any).toString()) as any;
  }
  if (Array.isArray(value)) return value.map((v) => toPlain(v)) as any;
  if (typeof value === "object") {
    const out: any = {};
    for (const k of Object.keys(value)) {
      out[k] = toPlain((value as any)[k]);
    }
    return out as any;
  }
  return value as any;
}
