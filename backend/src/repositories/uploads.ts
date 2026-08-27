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
