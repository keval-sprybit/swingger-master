import express from "express";
import cors from "cors";
import { config } from "./config/index.js";
import router from "./routes/router.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { prisma } from "./prisma.js";
import { seedSettings } from "./repositories/settings.js";
export const app = express();
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.get("/", (_req, res) => res.json({ name: "NSE Swing Trading Analyzer API", version: "1.0.0" }));
app.use("/api", router);
app.use(notFound);
app.use(errorHandler);
async function main() {
    try {
        await prisma.$connect();
        await seedSettings();
        console.log("[OK] Connected to MySQL and seeded settings.");
    }
    catch (err) {
        console.warn("[WARN] Could not connect to MySQL on startup. Configure DATABASE_URL and ensure the database exists.");
        console.warn(String(err instanceof Error ? err.message : err));
    }
    app.listen(config.port, () => {
        console.log(`NSE Swing Analyzer backend listening on http://localhost:${config.port}`);
    });
}
main().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map