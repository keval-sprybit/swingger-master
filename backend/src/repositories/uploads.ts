import { prisma } from "../prisma.js";
import { ReportType, UploadStatus, AnalysisType } from "@prisma/client";

export interface CreateUploadInput {
  originalFilename: string;
  storedFilename: string;
  reportType: ReportType;
  tradingDate: Date;
  filenameDate: Date | null;
  detectedDate: Date | null;
  uploadVersion: number;
  analysisType: AnalysisType;
  checksum: string;
  rowCount: number;
  validRows: number;
  invalidRows: number;
  detectedColumns?: string[];
  // Set when this upload row is a REUSE of an unchanged report (same SHA-256
  // checksum) from an earlier snapshot. Points to the upload whose report rows
  // hold the actual data. No new physical file or CSV rows are created.
  reusedFromUploadId?: number;
}

export async function createUpload(input: CreateUploadInput) {
  const metadata: { columns?: string[]; reusedFrom?: number } = {};
  if (input.detectedColumns?.length) metadata.columns = input.detectedColumns;
  if (input.reusedFromUploadId !== undefined) metadata.reusedFrom = input.reusedFromUploadId;
  return prisma.csvUpload.create({
    data: {
      originalFilename: input.originalFilename,
      storedFilename: input.storedFilename,
      reportType: input.reportType,
      tradingDate: input.tradingDate,
      filenameDate: input.filenameDate,
      detectedDate: input.detectedDate,
      uploadVersion: input.uploadVersion,
      analysisType: input.analysisType,
      uploadStatus: UploadStatus.PENDING,
      checksum: input.checksum,
      rowCount: input.rowCount,
      validRows: input.validRows,
      invalidRows: input.invalidRows,
      metadata: Object.keys(metadata).length ? metadata : undefined,
    },
  });
}

export async function updateUploadStatus(
  id: number,
  status: UploadStatus,
  extra?: { errorMessage?: string; processedAt?: Date }
) {
  return prisma.csvUpload.update({
    where: { id },
    data: {
      uploadStatus: status,
      ...(extra?.errorMessage !== undefined ? { errorMessage: extra.errorMessage } : {}),
      ...(extra?.processedAt ? { processedAt: extra.processedAt } : { processedAt: new Date() }),
    },
  });
}

export async function findUploadByChecksum(checksum: string) {
  return prisma.csvUpload.findFirst({ where: { checksum } });
}

// Return the upload id that holds the actual report data rows for a given
// upload. Reuse rows (created for unchanged reports) carry no data of their
// own — their rows live under the original upload referenced by metadata
// `reusedFrom` (following the chain to the first non-reuse upload).
export function resolveDataUploadId(upload: { id: number; metadata: unknown } | null | undefined): number | undefined {
  if (!upload) return undefined;
  const meta = (upload.metadata ?? {}) as { reusedFrom?: number };
  return meta.reusedFrom ?? upload.id;
}

// Create a logical REUSE upload row for an unchanged report, linking the new
// snapshot (version) to an already-existing upload without creating a new
// physical file or any new CSV data rows. Returns the created upload.
export async function createReuseUpload(
  source: {
    id: number;
    reportType: ReportType;
    tradingDate: Date | null;
    filenameDate: Date | null;
    detectedDate: Date | null;
    originalFilename: string;
    storedFilename: string;
    checksum: string;
    rowCount: number;
    validRows: number;
    invalidRows: number;
    metadata: unknown;
  },
  opts: { uploadVersion: number; analysisType: AnalysisType }
) {
  const meta = (source.metadata ?? {}) as { columns?: string[] };
  return createUpload({
    originalFilename: source.originalFilename,
    storedFilename: source.storedFilename,
    reportType: source.reportType,
    tradingDate: source.tradingDate ?? new Date(source.detectedDate ?? new Date()), // tradingDate is nullable on schema
    filenameDate: source.filenameDate,
    detectedDate: source.detectedDate,
    uploadVersion: opts.uploadVersion,
    analysisType: opts.analysisType,
    checksum: source.checksum,
    rowCount: source.rowCount,
    validRows: source.validRows,
    invalidRows: source.invalidRows,
    detectedColumns: meta.columns,
    reusedFromUploadId: source.id,
  });
}

// Given a set of logically-chosen uploads (one per report type for a snapshot),
// return the DATA upload ids to query for report rows — resolving reuse rows to
// the upload that actually stored the rows.
export function toDataUploadIds(uploads: { id: number; metadata: unknown }[]): number[] {
  return uploads.map((u) => resolveDataUploadId(u)!).filter((id) => id !== undefined);
}

export async function countUploadsForDate(
  tradingDate: Date,
  reportType: ReportType
): Promise<number> {
  return prisma.csvUpload.count({
    where: { tradingDate: tradingDate, reportType, uploadStatus: { not: UploadStatus.FAILED } },
  });
}

export async function listUploads() {
  return prisma.csvUpload.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
}

// For each report type on a given trading date, return the upload IDs of the
// single most recent valid (PROCESSED) snapshot. The dashboard uses this to
// show only the LATEST snapshot per report type, avoiding combining multiple
// intraday snapshots.
//
// Snapshots are identified by `uploadVersion`. Because each batch uploads all
// report types together and increments the per-date version for every report
// type, all files of one snapshot share the same version number. The latest
// version is therefore the latest snapshot.
//
// If `analysisType` is given, only uploads of that type are considered, so an
// INTRADAY dashboard never mixes in EOD rows (and vice-versa).
//
// Returns e.g.:
//   [{ reportType: "MOST_ACTIVE_VOLUME", version: 2, uploadIds: [15] }, ...]
export async function latestUploadPerReportType(tradingDate: Date, opts?: { version?: number; analysisType?: AnalysisType }) {
  const version = opts?.version;
  const analysisType = opts?.analysisType;
  const uploads = await prisma.csvUpload.findMany({
    where: { tradingDate, uploadStatus: "PROCESSED", ...(analysisType ? { analysisType } : {}) },
    orderBy: { id: "asc" },
  });
  if (uploads.length === 0) return [];
  // Pick the newest version per report type.
  const maxVersion: Record<string, number> = {};
  for (const u of uploads) {
    if ((maxVersion[u.reportType] ?? 0) < u.uploadVersion) maxVersion[u.reportType] = u.uploadVersion;
  }
  const targetVersion = version !== undefined
    ? version
    : Math.max(...Object.values(maxVersion)); // global max = latest snapshot
  const result: { reportType: string; version: number; analysisType: AnalysisType; uploadIds: number[] }[] = [];
  for (const u of uploads) {
    if (u.uploadVersion !== targetVersion) continue;
    let entry = result.find((r) => r.reportType === u.reportType);
    if (!entry) {
      entry = { reportType: u.reportType, version: u.uploadVersion, analysisType: u.analysisType, uploadIds: [] };
      result.push(entry);
    }
    // Use the DATA upload id (reuse rows resolve to their original upload).
    const dataId = resolveDataUploadId(u)!;
    if (dataId !== undefined && !entry.uploadIds.includes(dataId)) entry.uploadIds.push(dataId);
  }
  return result;
}

// Group processed uploads for a trading date into distinct snapshots, ordered
// newest-first. Each snapshot corresponds to a distinct `uploadVersion` (all
// report files of a batch share the same version). Used by History to let the
// user open each intraday/EOD snapshot separately.
//
// Each snapshot includes a per-report detail list so the UI can show whether a
// report was newly uploaded or REUSED from a prior snapshot (unchanged file).
export async function listSnapshotsForDate(tradingDate: Date) {
  const uploads = await prisma.csvUpload.findMany({
    where: { tradingDate, uploadStatus: "PROCESSED" },
    orderBy: { id: "asc" },
  });
  const versionById = new Map(uploads.map((u) => [u.id, u.uploadVersion]));
  const groups = new Map<number, { version: number; analysisType: AnalysisType; createdAt: Date; uploads: typeof uploads }>();
  for (const u of uploads) {
    let g = groups.get(u.uploadVersion);
    if (!g) {
      g = { version: u.uploadVersion, analysisType: u.analysisType, createdAt: u.createdAt, uploads: [] };
      groups.set(u.uploadVersion, g);
    }
    g.uploads.push(u);
    if (u.createdAt > g.createdAt) g.createdAt = u.createdAt;
  }
  const list = [...groups.values()].map((g) => {
    const reports = g.uploads.map((u) => {
      const meta = (u.metadata ?? {}) as { reusedFrom?: number };
      const reusedFrom = meta.reusedFrom ?? null;
      return {
        reportType: u.reportType,
        uploadId: u.id,
        dataUploadId: meta.reusedFrom ?? u.id,
        reusedFrom,
        reusedFromVersion: reusedFrom != null ? (versionById.get(reusedFrom) ?? null) : null,
        checksum: u.checksum,
      };
    });
    return {
      version: g.version,
      analysisType: g.analysisType,
      createdAt: g.createdAt,
      createdAtISO: g.createdAt.toISOString(),
      reportTypes: reports.map((r) => r.reportType),
      reportCount: reports.length,
      uploadIds: reports.map((r) => r.uploadId),
      reports,
    };
  });
  list.sort((a, b) => b.version - a.version);
  return list;
}
