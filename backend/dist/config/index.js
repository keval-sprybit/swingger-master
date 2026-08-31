import path from "path";
function num(name, fallback) {
    const v = process.env[name];
    if (v === undefined || v.trim() === "")
        return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}
export const config = {
    port: num("PORT", 3000),
    databaseUrl: process.env.DATABASE_URL ?? "",
    uploadDir: path.resolve(process.env.UPLOAD_DIR ?? "./uploads"),
    frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
    defaultCapital: num("DEFAULT_CAPITAL", 20000),
    defaultRiskPercent: num("DEFAULT_RISK_PERCENT", 1),
    minRiskReward: num("MIN_RISK_REWARD", 2),
    maxWatchlistSize: num("MAX_WATCHLIST_SIZE", 10),
    maxUploadBytes: 25 * 1024 * 1024,
};
export const REPORT_TYPES = [
    "MOST_ACTIVE_VOLUME",
    "MOST_ACTIVE_VALUE",
    "VOLUME_GAINERS",
    "WEEK52_HIGH",
    "WEEK52_LOW",
    "TOP_GAINERS",
    "TOP_LOSERS",
    "LARGE_DEALS",
    "BHAVCOPY",
];
export const REQUIRED_REPORTS = [
    "MOST_ACTIVE_VOLUME",
    "MOST_ACTIVE_VALUE",
    "VOLUME_GAINERS",
    "TOP_GAINERS",
    "TOP_LOSERS",
    "WEEK52_HIGH",
    "WEEK52_LOW",
    "LARGE_DEALS",
];
//# sourceMappingURL=index.js.map