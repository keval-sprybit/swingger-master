// Data-correction script: backfill REUSE upload rows for snapshots that were
// uploaded BEFORE reuse-on-duplicate was implemented. For each trading date +
// analysis type, if a snapshot (version) is missing a report type that exists
// in an EARLIER snapshot of the same analysis type, create a reusable upload
// row referencing that earlier report's data upload.
//
// Idempotent: skips report types already present in a snapshot.
import { prisma } from "../src/prisma.js";
import { AnalysisType, ReportType, UploadStatus } from "@prisma/client";
import { createReuseUpload, findUploadByChecksum } from "../src/repositories/uploads.js";
import { toDateString } from "../src/utils/date.js";

const dates = [new Date(2026, 7, 27)]; // correct any date as needed; can widen later

async function main() {
  for (const tradingDate of dates) {
    const uploads = await prisma.csvUpload.findMany({
      where: { tradingDate, uploadStatus: { not: UploadStatus.FAILED } },
      orderBy: { id: "asc" },
    });
    // Group by (analysisType)
    const byType = new Map<AnalysisType, typeof uploads>();
    for (const u of uploads) {
      if (!byType.has(u.analysisType)) byType.set(u.analysisType, []);
      byType.get(u.analysisType)!.push(u);
    }
    for (const [analysisType, list] of byType) {
      // Group by uploadVersion -> reportType -> upload
      const versions = new Map<number, Map<string, any>>();
      for (const u of list) {
        if (!versions.has(u.uploadVersion)) versions.set(u.uploadVersion, new Map());
        versions.get(u.uploadVersion)!.set(u.reportType, u);
      }
      const sortedVersions = [...versions.keys()].sort((a, b) => a - b);
      const reportTypes: ReportType[] = [
        "MOST_ACTIVE_VOLUME", "MOST_ACTIVE_VALUE", "VOLUME_GAINERS", "WEEK52_HIGH",
        "WEEK52_LOW", "TOP_GAINERS", "TOP_LOSERS", "LARGE_DEALS",
      ];
      for (const v of sortedVersions) {
        const present = versions.get(v)!;
        for (const rt of reportTypes) {
          if (present.has(rt)) continue;
          // Find the most recent earlier upload of this report type.
          const earlier = [...versions.entries()]
            .filter(([ev]) => ev < v)
            .map(([, m]) => m.get(rt))
            .filter((x) => x != null);
          if (earlier.length === 0) {
            console.log(`[SKIP] ${analysisType} v${v} ${rt}: no earlier snapshot to reuse from`);
            continue;
          }
          const source = earlier[earlier.length - 1];
          // If the missing one was a duplicate of source, validate checksum.
          const created = await createReuseUpload(source, { uploadVersion: v, analysisType });
          await prisma.csvUpload.update({ where: { id: created.id }, data: { uploadStatus: UploadStatus.PROCESSED, processedAt: new Date() } });
          console.log(`[REUSE] ${toDateString(tradingDate)} ${analysisType} v${v} ${rt}: new upload=${created.id} <- source=${source.id} (version ${source.uploadVersion})`);
        }
      }
    }
  }
}

await main();
await prisma.$disconnect();
