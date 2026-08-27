import { ReportType, UploadStatus, AnalysisType } from "@prisma/client";
import { detectAndParse } from "../parsers/index.js";
import { sha256, storeRawFile } from "../utils/files.js";
import { createUpload, updateUploadStatus, findUploadByChecksum, countUploadsForDate } from "../repositories/uploads.js";
import { saveReportRows } from "../repositories/reports.js";
import { rebuildDailyMetrics, ensureTradingDay } from "../repositories/metrics.js";
import { REPORT_TYPES } from "../config/index.js";
import { toDateString } from "../utils/date.js";

export interface ProcessOptions {
  reportType?: string;
  analysisType?: "EOD" | "INTRADAY";
  tradingDate?: string; // YYYY-MM-DD if forced
}

export interface ProcessResult {
  status: "PROCESSED" | "DUPLICATE" | "NEEDS_REVIEW" | "FAILED";
  reportType?: string;
  tradingDate?: string;
  filenameDate?: string;
  uploadId?: number;
  rowCount?: number;
  validRows?: number;
  invalidRows?: number;
  errors?: string[];
  preview?: Record<string, string>[];
  candidates?: string[];
  storedFilename?: string;
  checksum?: string;
  // Present for LARGE_DEALS when row-level deal dates differ from the report
  // trading date, so the UI can surface the distinction.
  dealDatesDetected?: boolean;
  tradeDateWarning?: string;
}

function toReportType(s: string): ReportType | null {
  return (REPORT_TYPES as readonly string[]).includes(s) ? (s as ReportType) : null;
}

export async function processUpload(
  buffer: Buffer,
  originalFilename: string,
  opts: ProcessOptions = {}
): Promise<ProcessResult> {
  const parsed = detectAndParse(buffer, originalFilename);

  let reportType: ReportType | null = null;
  if (opts.reportType) {
    reportType = toReportType(opts.reportType);
    if (!reportType) {
      return { status: "FAILED", errors: [`Invalid report type override: ${opts.reportType}`], preview: parsed.preview };
    }
  } else if (parsed.needsReview) {
    return {
      status: "NEEDS_REVIEW",
      candidates: parsed.candidates,
      errors: parsed.errors,
      preview: parsed.preview,
      rowCount: parsed.rowCount,
    };
  } else {
    reportType = parsed.reportType as ReportType;
  }

  // Resolve trading date
  let tradingDate: Date;
  if (opts.tradingDate) {
    const forced = new Date(opts.tradingDate + "T00:00:00");
    if (isNaN(forced.getTime())) return { status: "FAILED", errors: ["Invalid forced trading date."] };
    tradingDate = forced;
  } else if (parsed.detectedDate) {
    tradingDate = parsed.detectedDate;
  } else if (parsed.filenameDate) {
    tradingDate = parsed.filenameDate;
  } else {
    tradingDate = new Date();
    tradingDate.setHours(0, 0, 0, 0);
  }  const checksum = sha256(buffer);
  const existing = await findUploadByChecksum(checksum);
  if (existing) {
    return {
      status: "DUPLICATE",
      reportType: existing.reportType,
      tradingDate: toDateString(existing.detectedDate ?? existing.filenameDate ?? tradingDate),
      uploadId: existing.id,
      checksum,
      errors: ["An identical file (matching SHA-256 checksum) was already uploaded."],
    };
  }

  const uploadVersion = (await countUploadsForDate(tradingDate, reportType)) + 1;
  const analysisType: AnalysisType = opts.analysisType === "INTRADAY" ? AnalysisType.INTRADAY : AnalysisType.EOD;

  const { storedFilename } = await storeRawFile(buffer, originalFilename, tradingDate);

  const upload = await createUpload({
    originalFilename,
    storedFilename,
    reportType,
    tradingDate,
    filenameDate: parsed.filenameDate,
    detectedDate: parsed.detectedDate,
    uploadVersion,
    analysisType,
    checksum,
    rowCount: parsed.rowCount,
    validRows: parsed.validRows,
    invalidRows: parsed.invalidRows,
    detectedColumns: parsed.headers,
  });

  try {
    await ensureTradingDay(tradingDate);
    // Insert normalized report rows (never overwrite previous trading days).
    await saveReportRows(reportType, tradingDate, upload.id, parsed.rows);
    // Recompute combined daily metrics for this trading day only.
    await rebuildDailyMetrics(tradingDate);
    await updateUploadStatus(upload.id, UploadStatus.PROCESSED, { processedAt: new Date() });
  } catch (err: any) {
    await updateUploadStatus(upload.id, UploadStatus.FAILED, { errorMessage: String(err?.message ?? err) });
    return {
      status: "FAILED",
      reportType,
      tradingDate: toDateString(tradingDate),
      uploadId: upload.id,
      errors: [String(err?.message ?? err)],
    };
  }

  return {
    status: "PROCESSED",
    reportType,
    tradingDate: toDateString(tradingDate),
    filenameDate: parsed.filenameDate ? toDateString(parsed.filenameDate) : undefined,
    uploadId: upload.id,
    rowCount: parsed.rowCount,
    validRows: parsed.validRows,
    invalidRows: parsed.invalidRows,
    storedFilename,
    checksum,
    dealDatesDetected: parsed.dealDatesDetected,
    tradeDateWarning: parsed.dealDatesDetected
      ? "Report date differs from row-level deal dates. Row-level dates are preserved separately."
      : undefined,
  };
}
