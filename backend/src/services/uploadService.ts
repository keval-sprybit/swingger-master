import { ReportType, UploadStatus, AnalysisType } from "@prisma/client";
import { detectAndParse } from "../parsers/index.js";
import { sha256, storeRawFile } from "../utils/files.js";
import { createUpload, updateUploadStatus, findUploadByChecksum, countUploadsForDate, createReuseUpload } from "../repositories/uploads.js";
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
  status: "PROCESSED" | "DUPLICATE" | "REUSED" | "NEEDS_REVIEW" | "FAILED";
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
  // For REUSED results: the upload id this snapshot references for the report.
  reusedFromUploadId?: number;
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
  const analysisType: AnalysisType = opts.analysisType === "INTRADAY" ? AnalysisType.INTRADAY : AnalysisType.EOD;

  // Bhavcopy files are optional daily price-volume history, not part of the
  // 8-report snapshot set. They are stored into DailyPriceBar (history) rather
  // than a report table and do NOT advance the snapshot version.
  if (reportType === ReportType.BHAVCOPY) {
    const tradingDateBc = tradingDate;
    const existing = await findUploadByChecksum(checksum);
    if (existing) {
      // Identical bhavcopy already ingested for this day; no duplicate bars
      // will be created (DailyPriceBar is upserted by stock+date).
      return {
        status: "DUPLICATE",
        reportType,
        tradingDate: toDateString(existing.detectedDate ?? existing.filenameDate ?? tradingDateBc),
        uploadId: existing.id,
        checksum,
        rowCount: existing.rowCount,
        validRows: existing.validRows,
        invalidRows: existing.invalidRows,
        errors: ["An identical Bhavcopy file (matching SHA-256 checksum) was already ingested for this day."],
      };
    }
    const { storedFilename } = await storeRawFile(buffer, originalFilename, tradingDateBc);
    const upload = await createUpload({
      originalFilename,
      storedFilename,
      reportType,
      tradingDate: tradingDateBc,
      filenameDate: parsed.filenameDate,
      detectedDate: parsed.detectedDate,
      uploadVersion: 1,
      analysisType,
      checksum,
      rowCount: parsed.rowCount,
      validRows: parsed.validRows,
      invalidRows: parsed.invalidRows,
      detectedColumns: parsed.headers,
    });
    try {
      await ensureTradingDay(tradingDateBc);
      await saveReportRows(reportType, tradingDateBc, upload.id, parsed.rows);
      await updateUploadStatus(upload.id, UploadStatus.PROCESSED, { processedAt: new Date() });
      return {
        status: "PROCESSED",
        reportType,
        tradingDate: toDateString(tradingDateBc),
        filenameDate: parsed.filenameDate ? toDateString(parsed.filenameDate) : undefined,
        uploadId: upload.id,
        rowCount: parsed.rowCount,
        validRows: parsed.validRows,
        invalidRows: parsed.invalidRows,
        storedFilename,
        checksum,
      };
    } catch (err: any) {
      await updateUploadStatus(upload.id, UploadStatus.FAILED, { errorMessage: String(err?.message ?? err) });
      return { status: "FAILED", reportType, tradingDate: toDateString(tradingDateBc), uploadId: upload.id, errors: [String(err?.message ?? err)] };
    }
  }

  // The version this report will occupy in the new snapshot. Because every
  // snapshot batch uploads (or reuses) each report type, the per-date/report
  // count grows in lock-step across report types, so all reports of one
  // snapshot end up sharing the same version number.
  const targetVersion = (await countUploadsForDate(tradingDate, reportType)) + 1;

  const existing = await findUploadByChecksum(checksum);
  if (existing) {
    // An identical file was uploaded before. A snapshot represents the
    // complete market state at a time, so an unchanged report must still be
    // referenced by the new snapshot. We reuse the existing upload (no new
    // physical file, no duplicate CSV rows) and ATTACH it to the new snapshot.
    if (existing.uploadVersion < targetVersion) {
      const reuse = await createReuseUpload(existing, { uploadVersion: targetVersion, analysisType });
      // Mark it processed synchronously — it carries no data of its own.
      await updateUploadStatus(reuse.id, UploadStatus.PROCESSED, { processedAt: new Date() });
      return {
        status: "REUSED",
        reportType,
        tradingDate: toDateString(existing.detectedDate ?? existing.filenameDate ?? tradingDate),
        filenameDate: existing.filenameDate ? toDateString(existing.filenameDate) : undefined,
        uploadId: reuse.id,
        reusedFromUploadId: existing.id,
        rowCount: existing.rowCount,
        validRows: existing.validRows,
        invalidRows: existing.invalidRows,
        storedFilename: existing.storedFilename,
        checksum,
        dealDatesDetected: existing.reportType === ReportType.LARGE_DEALS,
        tradeDateWarning: existing.reportType === ReportType.LARGE_DEALS
          ? "Report unchanged; reused from a previous snapshot (no new file stored)."
          : undefined,
      };
    }
    // Otherwise the identical file already belongs to this exact snapshot — a
    // genuine duplicate within the batch. Report it as a duplicate (no-op).
    return {
      status: "DUPLICATE",
      reportType: existing.reportType,
      tradingDate: toDateString(existing.detectedDate ?? existing.filenameDate ?? tradingDate),
      uploadId: existing.id,
      checksum,
      errors: ["An identical file (matching SHA-256 checksum) was already uploaded."],
    };
  }

  const uploadVersion = targetVersion;

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
