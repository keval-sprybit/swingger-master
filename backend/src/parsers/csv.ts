import { parse } from "csv-parse/sync";

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

// Parse CSV buffer into headers + records. Tolerate BOM, extra whitespace.
export function parseCsvBuffer(buffer: Buffer): ParsedCsv {
  const text = buffer.toString("utf8").replace(/^﻿/, "");
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  }) as Record<string, string>[];

  if (records.length === 0) {
    return { headers: [], rows: [], rowCount: 0 };
  }
  const headers = Object.keys(records[0]);
  return { headers, rows: records, rowCount: records.length };
}

// Read the first few lines manually to detect headers without full parse (used by upload preview).
export function peekCsvHeaders(buffer: Buffer, maxBytes = 4096): string[] {
  const text = buffer.toString("utf8", 0, Math.min(buffer.length, maxBytes)).replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  return firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
}
