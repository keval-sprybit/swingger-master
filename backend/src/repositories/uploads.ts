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
}

export async function createUpload(input: CreateUploadInput) {
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
      metadata: input.detectedColumns ? { columns: input.detectedColumns } : undefined,
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
// Returns e.g.:
//   [{ reportType: "MOST_ACTIVE_VOLUME", version: 2, uploadIds: [15] }, ...]
export async function latestUploadPerReportType(tradingDate: Date, version?: number) {
  const uploads = await prisma.csvUpload.findMany({
    where: { tradingDate, uploadStatus: "PROCESSED" },
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
  const result: { reportType: string; version: number; uploadIds: number[] }[] = [];
  for (const u of uploads) {
    if (u.uploadVersion !== targetVersion) continue;
    let entry = result.find((r) => r.reportType === u.reportType);
    if (!entry) {
      entry = { reportType: u.reportType, version: u.uploadVersion, uploadIds: [] };
      result.push(entry);
    }
    entry.uploadIds.push(u.id);
  }
  return result;
}

// Group processed uploads for a trading date into distinct snapshots, ordered
// newest-first. Each snapshot corresponds to a distinct `uploadVersion` (all
// report files of a batch share the same version). Used by History to let the
// user open each intraday/EOD snapshot separately.
export async function listSnapshotsForDate(tradingDate: Date) {
  const uploads = await prisma.csvUpload.findMany({
    where: { tradingDate, uploadStatus: "PROCESSED" },
    orderBy: { id: "asc" },
  });
  const groups = new Map<number, { version: number; analysisType: AnalysisType; createdAt: Date; reportTypes: Set<string>; uploadIds: number[] }>();
  for (const u of uploads) {
    let g = groups.get(u.uploadVersion);
    if (!g) {
      g = { version: u.uploadVersion, analysisType: u.analysisType, createdAt: u.createdAt, reportTypes: new Set<string>(), uploadIds: [] };
      groups.set(u.uploadVersion, g);
    }
    g.reportTypes.add(u.reportType);
    g.uploadIds.push(u.id);
    if (u.createdAt > g.createdAt) g.createdAt = u.createdAt;
  }
  const list = [...groups.values()].map((g) => ({
    version: g.version,
    analysisType: g.analysisType,
    createdAt: g.createdAt,
    createdAtISO: g.createdAt.toISOString(),
    reportTypes: [...g.reportTypes],
    reportCount: g.reportTypes.size,
    uploadIds: g.uploadIds,
  }));
  list.sort((a, b) => b.version - a.version);
  return list;
}
