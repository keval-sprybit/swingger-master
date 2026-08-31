import { processUpload } from "../services/uploadService.js";
import { listUploads } from "../repositories/uploads.js";
import { asyncHandler } from "../middleware/error.js";
import { detectAndParse } from "../parsers/index.js";
export const uploadController = {
    uploadFiles: asyncHandler(async (req, res) => {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: "No files provided." });
        }
        const reportType = req.body?.reportType || undefined;
        const analysisType = req.body?.analysisType || "EOD";
        const tradingDate = req.body?.tradingDate || undefined;
        const results = [];
        for (const f of files) {
            try {
                const r = await processUpload(f.buffer, f.originalname, { reportType, analysisType, tradingDate });
                results.push({ filename: f.originalname, ...r });
            }
            catch (err) {
                results.push({ filename: f.originalname, status: "FAILED", errors: [String(err?.message ?? err)] });
            }
        }
        res.json({ count: results.length, results });
    }),
    preview: asyncHandler(async (req, res) => {
        const file = req.files?.[0] ?? req.file;
        if (!file)
            return res.status(400).json({ error: "No file provided." });
        const parsed = detectAndParse(file.buffer, file.originalname);
        res.json({
            filename: file.originalname,
            reportType: parsed.reportType,
            confidence: parsed.confidence,
            needsReview: parsed.needsReview,
            candidates: parsed.candidates,
            detectedDate: parsed.detectedDate ? parsed.detectedDate.toISOString().slice(0, 10) : null,
            filenameDate: parsed.filenameDate ? parsed.filenameDate.toISOString().slice(0, 10) : null,
            dateSource: parsed.dateSource,
            headers: parsed.headers,
            rowCount: parsed.rowCount,
            validRows: parsed.validRows,
            invalidRows: parsed.invalidRows,
            preview: parsed.preview,
        });
    }),
    list: asyncHandler(async (_req, res) => {
        res.json({ uploads: await listUploads() });
    }),
};
//# sourceMappingURL=uploadController.js.map