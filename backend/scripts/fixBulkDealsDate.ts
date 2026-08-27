// One-off data correction: reassign a mis-dated Large Deals / Bulk Deals upload.
//
// Background:
//   Bulk Deals CSVs contain a row-level DATE column (the transaction/deal date).
//   Earlier code wrongly used that DATE as the report/trading date, so a file
//   uploaded on the 27th (e.g. Large-deals-BULK-27-Aug-2026.csv) got stored
//   under the previous day (26th) when its rows carried 26-Aug dates.
//
// Fix:
//   - Reassign the matched CsvUpload.tradingDate -> correct report date
//   - Move the upload's LargeDeal rows to the correct report date (tradingDate)
//     WITHOUT changing their original row-level tradeDate values
//   - Move the physical file to the correct uploads/YYYY/MM/DD/ folder
//   - Rebuild daily metrics for both the old and new dates
//
// Run:  npm run fix:bulk-deals-date -- <originalFilename> <correctDate> [<wrongDate>]
//   e.g. npm run fix:bulk-deals-date -- "Large-deals-BULK-27-Aug-2026.csv" 2026-08-27 2026-08-26
//
// Idempotent: if the upload is already on the correct date it does nothing.

import fs from "fs/promises";
import path from "path";
import { prisma } from "../src/prisma.js";
import { config } from "../src/config/index.js";
import { rebuildDailyMetrics } from "../src/repositories/metrics.js";
import { toDateString } from "../src/utils/date.js";

function parseDateArg(s: string): Date {
  const dt = new Date(s + "T00:00:00");
  if (isNaN(dt.getTime())) throw new Error(`Invalid date: ${s} (expected YYYY-MM-DD)`);
  return dt;
}

function dayOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function subPath(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

async function moveFile(storedFilename: string, fromDate: Date, toDate: Date): Promise<boolean> {
  const fromDir = path.join(config.uploadDir, subPath(fromDate));
  const toDir = path.join(config.uploadDir, subPath(toDate));
  const src = path.join(fromDir, storedFilename);
  const dst = path.join(toDir, storedFilename);
  try {
    await fs.access(src);
  } catch {
    console.warn(`  [warn] physical file not found at ${src}`);
    return false;
  }
  await fs.mkdir(toDir, { recursive: true });
  await fs.rename(src, dst);
  console.log(`  moved ${src}`);
  console.log(`    -> ${dst}`);
  return true;
}

async function main() {
  const originalFilename = process.argv[2];
  const correctDateStr = process.argv[3];
  const wrongDateStr = process.argv[4];

  if (!originalFilename || !correctDateStr) {
    console.error(
      "Usage: fix:bulk-deals-date -- <originalFilename> <correctDate> [<wrongDate>]"
    );
    console.error('  e.g. fix:bulk-deals-date -- "Large-deals-BULK-27-Aug-2026.csv" 2026-08-27 2026-08-26');
    process.exit(1);
  }

  const correctDate = parseDateArg(correctDateStr);

  // Find the upload by its original filename.
  const upload = await prisma.csvUpload.findFirst({
    where: { originalFilename, reportType: "LARGE_DEALS" },
    orderBy: { createdAt: "asc" },
  });
  if (!upload) {
    console.error(`No upload found with originalFilename="${originalFilename}" and reportType=LARGE_DEALS`);
    process.exit(1);
  }

  const oldDate = upload.tradingDate ? dayOf(upload.tradingDate) : undefined;
  const newDate = dayOf(correctDate);

  if (oldDate && oldDate.getTime() === newDate.getTime()) {
    console.log(`Upload #${upload.id} is already dated ${toDateString(newDate)}. Nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`Upload #${upload.id}: ${upload.originalFilename}`);
  console.log(`  current tradingDate: ${oldDate ? toDateString(oldDate) : "(null)"}`);
  console.log(`  target tradingDate:  ${toDateString(newDate)}`);

  if (wrongDateStr) {
    const wrongDate = parseDateArg(wrongDateStr);
    if (!oldDate || oldDate.getTime() !== dayOf(wrongDate).getTime()) {
      console.error(
        `[note] The upload's current tradingDate ${oldDate ? toDateString(oldDate) : "null"} does not match the "wrongDate" you provided (${wrongDateStr}). Proceeding anyway.`
      );
    }
  }

  // 1. Reassign the upload's tradingDate plus its detected/filename date if null.
  await prisma.csvUpload.update({
    where: { id: upload.id },
    data: {
      tradingDate: newDate,
      detectedDate: upload.detectedDate ?? newDate,
      filenameDate: upload.filenameDate ?? newDate,
    },
  });
  console.log(`  CsvUpload.tradingDate updated -> ${toDateString(newDate)}`);

  // 2. Move the LargeDeal rows to the correct report date, preserving tradeDate.
  const rows = await prisma.largeDeal.findMany({ where: { uploadId: upload.id } });
  for (const row of rows) {
    const preservedTradeDate = row.tradeDate ?? row.tradingDate;
    await prisma.largeDeal.update({
      where: { id: row.id },
      data: {
        tradingDate: newDate,
        filenameDate: newDate,
        // tradeDate intentionally NOT changed here.
        tradeDate: preservedTradeDate,
      },
    });
  }
  console.log(`  Moved ${rows.length} LargeDeal rows -> ${toDateString(newDate)} (tradeDate preserved)`);

  // 3. Move the physical file.
  if (upload.storedFilename) {
    if (oldDate) {
      await moveFile(upload.storedFilename, oldDate, newDate);
    } else {
      console.warn("  [warn] upload had no trading date; cannot move physical file by date.");
    }
  }

  // 4. Rebuild metrics for both affected trading days.
  await rebuildDailyMetrics(newDate);
  console.log(`  metrics rebuilt for ${toDateString(newDate)}`);
  if (oldDate) {
    await rebuildDailyMetrics(oldDate);
    console.log(`  metrics rebuilt for ${toDateString(oldDate)}`);
  }

  await prisma.$disconnect();
  console.log("Done.");
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
