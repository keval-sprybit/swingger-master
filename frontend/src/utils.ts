export function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return "₹" + fmt(n);
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const v = Number(n);
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export function fmtVol(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (n >= 1e7) return (n / 1e7).toFixed(2) + " Cr";
  if (n >= 1e5) return (n / 1e5).toFixed(2) + " L";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toString();
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
