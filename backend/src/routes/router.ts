import { Router } from "express";
import { uploadController } from "../controllers/uploadController.js";
import { analysisController } from "../controllers/analysisController.js";
import { settingsController } from "../controllers/settingsController.js";
import { paperTradeController } from "../controllers/paperTradeController.js";
import { backtestController } from "../controllers/backtestController.js";
import { upload } from "../middleware/upload.js";

const router = Router();

// Uploads
router.post("/uploads", upload.array("files", 50), uploadController.uploadFiles);
router.post("/uploads/preview", upload.array("files", 1), uploadController.preview);
router.get("/uploads", uploadController.list);

// Analysis
router.post("/analysis/run", analysisController.run);
router.get("/dashboard", analysisController.dashboard);
router.get("/candidates", analysisController.candidates);
router.get("/candidates/:symbol", analysisController.candidateDetail);
router.get("/candidates/:symbol/chart", analysisController.chart);
router.get("/watchlist", analysisController.watchlist);
router.get("/history", analysisController.history);
router.get("/stocks/:symbol/history", analysisController.stockHistory);

// Settings
router.get("/settings", settingsController.get);
router.put("/settings", settingsController.update);

// Paper trades
router.get("/paper-trades", paperTradeController.list);
router.post("/paper-trades", paperTradeController.create);
router.get("/paper-trades/:id", paperTradeController.get);
router.put("/paper-trades/:id", paperTradeController.update);

// Backtesting
router.post("/backtest", backtestController.run);
router.get("/backtest", backtestController.list);
router.get("/backtest/:id", backtestController.get);

// Health
router.get("/health", (_req, res) => res.json({ status: "ok" }));

export default router;
