const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const MONTHS_INV = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Parse a date-only value to a Date at local midnight (no timezone shift). Returns null if invalid.
export function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (raw === "") return null;

  const lower = raw.toLowerCase();

  // Try DD-Mon-YYYY or DD-Mon-YY  e.g. 27-Aug-2026 / 27-AUG-26
  const monMatch = lower.match(/^(\d{1,2})[-/ ]+([a-z]{3,})[-/ ]+(\d{2,4})$/);
  if (monMatch) {
    const day = parseInt(monMatch[1], 10);
    const mon = MONTHS[monMatch[2].slice(0, 3)];
    let year = parseInt(monMatch[3], 10);
    if (!mon) return null;
    if (year < 100) year += 2000;
    const dt = new Date(year, mon - 1, day);
    return isValid(dt, year, mon, day) ? dt : null;
  }

  // Try YYYY-MM-DD or YYYY/MM/DD
  const iso = lower.match(/^(\d{4})[-/ ]+(\d{1,2})[-/ ]+(\d{1,2})/);
  if (iso) {
    const year = parseInt(iso[1], 10);
    const mon = parseInt(iso[2], 10);
    const day = parseInt(iso[3], 10);
    const dt = new Date(year, mon - 1, day);
    return isValid(dt, year, mon, day) ? dt : null;
  }

  // Try DD-MM-YYYY or DD/MM/YYYY
  const dmy = lower.match(/^(\d{1,2})[-/ ]+(\d{1,2})[-/ ]+(\d{2,4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const mon = parseInt(dmy[2], 10);
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    const dt = new Date(year, mon - 1, day);
    return isValid(dt, year, mon, day) ? dt : null;
  }

  // Last resort: JS Date parse (ISO)
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function isValid(dt: Date, year: number, mon: number, day: number): boolean {
  return dt.getFullYear() === year && dt.getMonth() === mon - 1 && dt.getDate() === day;
}

// Convert a Date to YYYY-MM-DD string (date only, local). Used for DB date columns.
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDisplay(date: Date | null | undefined): string {
  if (!date) return "";
  return `${String(date.getDate()).padStart(2, "0")}-${MONTHS_INV[date.getMonth()]}-${date.getFullYear()}`;
}

// Detect a trading date embedded in a filename like ...27-Aug-2026... or ...2026-08-27...
export function detectDateFromFilename(filename: string): Date | null {
  const lower = filename.toLowerCase();
  // 27-aug-2026 / 27-aug-26
  const mon = lower.match(/(\d{1,2})[-_ ]*([a-z]{3})[-_ ]*(\d{2,4})/);
  if (mon) {
    const day = parseInt(mon[1], 10);
    const m = MONTHS[mon[2].slice(0, 3)];
    let year = parseInt(mon[3], 10);
    if (!m) return null;
    if (year < 100) year += 2000;
    const dt = new Date(year, m - 1, day);
    if (isValid(dt, year, m, day)) return dt;
  }
  // 2026-08-27
  const iso = lower.match(/(\d{4})[-_ ](\d{1,2})[-_ ](\d{1,2})/);
  if (iso) {
    const year = parseInt(iso[1], 10);
    const m = parseInt(iso[2], 10);
    const day = parseInt(iso[3], 10);
    const dt = new Date(year, m - 1, day);
    if (isValid(dt, year, m, day)) return dt;
  }
  return null;
}

// Generate uploads/YYYY/MM/DD path segment from a date
export function uploadSubPath(date: Date): string {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate()
  ).padStart(2, "0")}`;
}
