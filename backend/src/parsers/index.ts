import { parseCsvBuffer } from "./csv.js";
import {
  REPORT_SCHEMAS,
  detectReportType,
  detectTradingDate,
  buildColumnMap,
} from "./columns.js";
import {
  NormalizedRow,
  normalizeOhlc,
  normalizeVolumeGainer,
  normalizeWeek52High,
  normalizeWeek52Low,
  normalizeLargeDeal,
  normalizeBhavcopy,
} from "./normalize.js";

export interface ParseOutcome {
  reportType: string;
  confidence: "HIGH" | "LOW";
  needsReview: boolean;
  candidates: string[];
  headers: string[];
  rowCount: number;
  detectedDate: Date | null;
  filenameDate: Date | null;
  dateSource: "content" | "filename" | "none";
  // For LARGE_DEALS: present when row-level DATE values differ from the
  // report/trading date, so callers can warn about the distinction.
  dealDatesDetected: boolean;
  rows: NormalizedRow[];
  validRows: number;
  invalidRows: number;
  errors: string[];
  preview: Record<string, string>[];
}

export function detectAndParse(buffer: Buffer, originalFilename: string): ParseOutcome {
  const { headers, rows, rowCount } = parseCsvBuffer(buffer);
  const errors: string[] = [];
  const preview = rows.slice(0, 5);

  if (headers.length === 0) {
    return {
      reportType: "NEEDS_REVIEW",
      confidence: "LOW",
      needsReview: true,
      candidates: [],
      headers,
      rowCount: 0,
      detectedDate: null,
      filenameDate: null,
      dateSource: "none",
      dealDatesDetected: false,
      rows: [],
      validRows: 0,
      invalidRows: 0,
      errors: ["File is empty or has no readable header row."],
      preview,
    };
  }

  const detection = detectReportType(headers, originalFilename);
  const dateDetection = detectTradingDate(headers, rows, originalFilename, detection.reportType);

  const schema = REPORT_SCHEMAS.find((s) => s.type === detection.reportType);
  const normalized: NormalizedRow[] = [];
  let validRows = 0;
  let invalidRows = 0;

  if (schema && !detection.needsReview) {
    const colMap = buildColumnMap(schema, headers);
    const filenameDate = dateDetection.filenameDate;
    for (const row of rows) {
      let nr: NormalizedRow;
      switch (schema.type) {
        case "MOST_ACTIVE_VOLUME":
        case "MOST_ACTIVE_VALUE":
        case "TOP_GAINERS":
        case "TOP_LOSERS":
          nr = normalizeOhlc(row, colMap);
          break;
        case "VOLUME_GAINERS":
          nr = normalizeVolumeGainer(row, colMap);
          break;
        case "WEEK52_HIGH":
          nr = normalizeWeek52High(row, colMap);
          break;
        case "WEEK52_LOW":
          nr = normalizeWeek52Low(row, colMap);
          break;
        case "LARGE_DEALS":
          nr = normalizeLargeDeal(row, colMap, filenameDate);
          break;
        case "BHAVCOPY":
          nr = normalizeBhavcopy(row, colMap);
          break;
        default:
          nr = { symbol: "", raw: row };
      }
      if (nr.symbol && nr.symbol.length > 0) {
        normalized.push(nr);
        validRows++;
      } else {
        invalidRows++;
        if (invalidRows <= 5) errors.push(`Row missing symbol: ${JSON.stringify(row).slice(0, 120)}`);
      }
    }
  } else if (detection.needsReview) {
    // Still parse what we can using any schema candidate for preview, but mark rows invalid.
    invalidRows = rowCount;
    errors.push(
      `Could not confidently detect report type. Candidates: ${detection.candidates.join(", ") || "none"}.`
    );
  }

  return {
    reportType: detection.reportType,
    confidence: detection.confidence,
    needsReview: detection.needsReview,
    candidates: detection.candidates,
    headers,
    rowCount,
    detectedDate: dateDetection.detectedDate,
    filenameDate: dateDetection.filenameDate,
    dateSource: dateDetection.source,
    dealDatesDetected:
      detection.reportType === "LARGE_DEALS" &&
      normalized.some((r) => r.tradeDate !== undefined && dateDetection.detectedDate !== null && r.tradeDate!.getTime() !== dateDetection.detectedDate.getTime()),
    rows: normalized,
    validRows,
    invalidRows,
    errors,
    preview,
  };
}
