import { prisma } from "../prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { runAnalysis } from "../services/analysisService.js";
import { toPlain } from "../utils/serialize.js";
import { toDateString } from "../utils/date.js";
import { REQUIRED_REPORTS } from "../config/index.js";
import { ensureTradingDay } from "../repositories/metrics.js";
import { latestUploadPerReportType, listSnapshotsForDate } from "../repositories/uploads.js";
import { getDailyChart } from "../services/chartService.js";
function marketStatusNow() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const t = h + m / 60;
    if (t < 9)
        return "PRE_MARKET";
    if (t < 15.5)
        return "OPEN";
    return "CLOSED";
}
async function getLatestRun(date) {
    return prisma.analysisRun.findFirst({
        where: { tradingDate: date },
        orderBy: { id: "desc" },
    });
}
function modeFromAnalysisType(t) {
    return t === "INTRADAY" ? "INTRADAY" : "SWING";
}
// The run that backs a given analysis mode:
//   INTRADAY -> an INTRADAY analysis run (today's intraday analysis)
//   SWING    -> an EOD / PRE_MARKET run (next-session swing analysis)
async function getRunForMode(date, mode) {
    const types = mode === "INTRADAY" ? ["INTRADAY"] : ["EOD", "PRE_MARKET"];
    return prisma.analysisRun.findFirst({
        where: { tradingDate: date, analysisType: { in: types } },
        orderBy: { id: "desc" },
    });
}
function parseRunMetadata(meta) {
    if (!meta || typeof meta !== "object")
        return {};
    return meta;
}
async function completeness(date) {
    const uploads = await prisma.csvUpload.findMany({
        where: { tradingDate: date, uploadStatus: "PROCESSED" },
        select: { reportType: true },
    });
    const received = new Set(uploads.map((u) => u.reportType));
    const present = REQUIRED_REPORTS.filter((r) => received.has(r));
    // Bhavcopy / daily price data is tracked separately from the 8-report
    // screening set — it must not inflate the NSE reports count.
    const priceDataReceived = received.has("BHAVCOPY");
    return {
        received: present.length,
        expected: REQUIRED_REPORTS.length,
        missing: REQUIRED_REPORTS.filter((r) => !received.has(r)),
        reportTypes: [...received],
        priceData: priceDataReceived ? 1 : 0,
        priceDataExpected: 1,
    };
}
export const analysisController = {
    run: asyncHandler(async (req, res) => {
        const { tradingDate, analysisType, mode } = req.body ?? {};
        if (!tradingDate)
            return res.status(400).json({ error: "tradingDate is required." });
        const result = await runAnalysis(tradingDate, analysisType ?? "EOD", mode);
        res.json(result);
    }),
    dashboard: asyncHandler(async (req, res) => {
        let dateStr = req.query.date;
        if (!dateStr) {
            const latest = await prisma.tradingDay.findFirst({ orderBy: { tradingDate: "desc" } });
            dateStr = latest ? toDateString(latest.tradingDate) : toDateString(new Date());
        }
        const date = new Date(dateStr + "T00:00:00");
        await ensureTradingDay(date);
        const comp = await completeness(date);
        // Optional snapshot version (e.g. from the History page) selects a specific
        // intraday/EOD snapshot's report rows rather than the latest one.
        const snapshotVersion = req.query.snapshot ? Number(req.query.snapshot) : undefined;
        // Decide which analysis type (and therefore which MODE) to surface:
        //  - while the market is open, show the latest INTRADAY snapshot;
        //  - after close, show the latest EOD snapshot;
        //  - when an explicit historical snapshot version is requested, use that
        //    snapshot's own analysis type;
        //  - an explicit ?mode= query wins over all of the above.
        const marketStatus = marketStatusNow();
        const marketOpen = marketStatus !== "CLOSED";
        let sectionAnalysisType = marketOpen ? "INTRADAY" : "EOD";
        if (snapshotVersion !== undefined) {
            const snapshotUpload = await prisma.csvUpload.findFirst({
                where: { tradingDate: date, uploadStatus: "PROCESSED", uploadVersion: snapshotVersion },
                orderBy: { id: "asc" },
            });
            if (snapshotUpload)
                sectionAnalysisType = snapshotUpload.analysisType === "EOD" ? "EOD" : "INTRADAY";
        }
        const mode = req.query.mode === "INTRADAY" || req.query.mode === "SWING"
            ? req.query.mode
            : modeFromAnalysisType(sectionAnalysisType);
        const run = await getRunForMode(date, mode);
        const runMeta = parseRunMetadata(run?.metadata);
        let scores = [];
        let setupMap = new Map();
        if (run) {
            scores = await prisma.dailyStockScore.findMany({
                where: { analysisRunId: run.id },
                include: { stock: true },
                orderBy: { rank: "asc" },
            });
            const setups = await prisma.tradeSetup.findMany({ where: { analysisRunId: run.id } });
            setupMap = new Map(setups.map((s) => [s.stockId, s]));
        }
        const topCandidates = scores.slice(0, 15).map((s) => {
            const st = setupMap.get(s.stockId);
            return {
                rank: s.rank,
                symbol: s.stock.symbol,
                company: s.stock.companyName,
                score: s.normalizedScore,
                explainableScore: st?.explainableScore ?? null,
                classification: s.classification,
                changePercent: undefined,
                ltp: st?.currentPrice ?? null,
                status: st?.status ?? null,
                breakoutLevel: st?.breakoutLevel ?? null,
                breakoutStatus: st?.breakoutStatus ?? null,
                riskReward1: st?.riskReward1 ?? null,
                trend: st?.trend ?? null,
                whySelected: st?.whySelected ?? [],
                signals: s.signals,
            };
        });
        const latestEntries = await latestUploadPerReportType(date, { version: snapshotVersion, analysisType: sectionAnalysisType });
        let sectionSnapshotCreatedAt = null;
        if (snapshotVersion !== undefined) {
            const s = (await listSnapshotsForDate(date)).find((x) => x.version === snapshotVersion);
            sectionSnapshotCreatedAt = s?.createdAtISO ?? null;
        }
        const uploadIdsFor = (reportType) => latestEntries.find((e) => e.reportType === reportType)?.uploadIds;
        const idFilter = (reportType) => {
            const ids = uploadIdsFor(reportType);
            return ids && ids.length > 0 ? { uploadId: { in: ids } } : { tradingDate: date };
        };
        const [maVol, maVal, volGainers, w52h, w52l, topGainers, topLosers, large] = await Promise.all([
            prisma.mostActiveVolume.findMany({ where: idFilter("MOST_ACTIVE_VOLUME"), orderBy: { volume: "desc" }, take: 20, include: { stock: true } }),
            prisma.mostActiveValue.findMany({ where: idFilter("MOST_ACTIVE_VALUE"), orderBy: { turnover: "desc" }, take: 10, include: { stock: true } }),
            prisma.volumeGainer.findMany({ where: idFilter("VOLUME_GAINERS"), orderBy: { volumeRatio1w: "desc" }, take: 20, include: { stock: true } }),
            prisma.week52High.findMany({ where: idFilter("WEEK52_HIGH"), orderBy: { ltp: "desc" }, take: 10, include: { stock: true } }),
            prisma.week52Low.findMany({ where: idFilter("WEEK52_LOW"), orderBy: { ltp: "asc" }, take: 10, include: { stock: true } }),
            prisma.topGainer.findMany({ where: idFilter("TOP_GAINERS"), orderBy: [{ rank: "asc" }, { changePercent: "desc" }], take: 20, include: { stock: true } }),
            prisma.topLoser.findMany({ where: idFilter("TOP_LOSERS"), orderBy: [{ rank: "asc" }, { changePercent: "asc" }], take: 20, include: { stock: true } }),
            prisma.largeDeal.findMany({ where: idFilter("LARGE_DEALS"), orderBy: { quantityTraded: "desc" }, take: 12, include: { stock: true } }),
        ]);
        const watchlist = run
            ? await prisma.watchlistItem.findMany({
                where: { watchlist: { analysisRunId: run.id } },
                include: { stock: true, tradeSetup: true },
                orderBy: { rank: "asc" },
            })
            : [];
        let avoided = [];
        if (run) {
            const avoidSetups = await prisma.tradeSetup.findMany({ where: { analysisRunId: run.id, status: "AVOID" }, include: { stock: true }, take: 10 });
            avoided = avoidSetups.map((s) => ({ symbol: s.stock.symbol, reason: s.reason, status: s.status }));
        }
        const noTrade = run ? watchlist.length === 0 : false;
        res.json(toPlain({
            tradingDate: dateStr,
            marketStatus: marketStatus,
            completeness: comp,
            mode,
            analysisType: run?.analysisType ?? null,
            analysisStatus: run?.status ?? null,
            marketCondition: runMeta.marketCondition ?? null,
            marketReason: runMeta.marketReason ?? null,
            sectionAnalysisType,
            sectionSnapshotVersion: latestEntries[0]?.version ?? null,
            sectionSnapshotCreatedAt,
            nextTradingDate: run?.id ? (await prisma.dailyWatchlist.findUnique({ where: { analysisRunId: run.id } }))?.nextTradingDate?.toISOString().slice(0, 10) : null,
            topCandidates,
            sections: {
                mostActiveVolume: maVol,
                mostActiveValue: maVal,
                volumeGainers: volGainers,
                week52High: w52h,
                week52Low: w52l,
                topGainers: topGainers,
                topLosers: topLosers,
                largeDeals: large,
                avoid: avoided,
                noTrade,
            },
            watchlist: watchlist.map((w) => ({
                rank: w.rank,
                symbol: w.stock.symbol,
                company: w.stock.companyName,
                score: w.score,
                status: w.status,
                setup: w.tradeSetup,
            })),
        }));
    }),
    candidates: asyncHandler(async (req, res) => {
        const dateStr = req.query.date || toDateString(new Date());
        const date = new Date(dateStr + "T00:00:00");
        const limit = Number(req.query.limit) || 100;
        const mode = req.query.mode === "INTRADAY" || req.query.mode === "SWING" ? req.query.mode : "SWING";
        const run = await getRunForMode(date, mode);
        if (!run)
            return res.json({ tradingDate: dateStr, candidates: [] });
        const scores = await prisma.dailyStockScore.findMany({
            where: { analysisRunId: run.id },
            include: { stock: true },
            orderBy: { rank: "asc" },
        });
        const setups = await prisma.tradeSetup.findMany({ where: { analysisRunId: run.id } });
        const setupMap = new Map(setups.map((s) => [s.stockId, s]));
        const metricMap = new Map((await prisma.dailyStockMetric.findMany({ where: { tradingDate: date } })).map((m) => [m.stockId, m]));
        const candidates = scores.slice(0, limit).map((s) => {
            const st = setupMap.get(s.stockId);
            const m = metricMap.get(s.stockId);
            return {
                rank: s.rank,
                symbol: s.stock.symbol,
                company: s.stock.companyName,
                score: s.normalizedScore,
                explainableScore: st?.explainableScore ?? null,
                classification: s.classification,
                changePercent: m?.changePercent ?? null,
                ltp: st?.currentPrice ?? m?.ltp ?? null,
                volumeRatio: m?.volumeRatio1w ?? null,
                turnover: m?.turnover ?? null,
                is52wHigh: m?.is52wHigh ?? false,
                status: st?.status ?? null,
                breakoutLevel: st?.breakoutLevel ?? null,
                breakoutStatus: st?.breakoutStatus ?? null,
                breakoutReason: st?.breakoutReason ?? null,
                stopLossReason: st?.stopLossReason ?? null,
                riskReward1: st?.riskReward1 ?? null,
                trend: st?.trend ?? null,
                whySelected: st?.whySelected ?? [],
                signals: s.signals,
                setup: st,
            };
        });
        res.json(toPlain({ tradingDate: dateStr, mode, candidates }));
    }),
    candidateDetail: asyncHandler(async (req, res) => {
        const symbol = req.params.symbol.toUpperCase();
        const dateStr = req.query.date || toDateString(new Date());
        const date = new Date(dateStr + "T00:00:00");
        const mode = req.query.mode === "INTRADAY" || req.query.mode === "SWING" ? req.query.mode : "SWING";
        const stock = await prisma.stock.findUnique({ where: { symbol } });
        if (!stock)
            return res.status(404).json({ error: "Stock not found." });
        const run = await getRunForMode(date, mode);
        const metric = await prisma.dailyStockMetric.findUnique({ where: { tradingDate_stockId: { tradingDate: date, stockId: stock.id } } });
        let score = null;
        let setup = null;
        if (run) {
            score = await prisma.dailyStockScore.findFirst({ where: { analysisRunId: run.id, stockId: stock.id } });
            setup = await prisma.tradeSetup.findFirst({ where: { analysisRunId: run.id, stockId: stock.id } });
        }
        // Bhavcopy history for the technical chart / indicator context.
        const priceBars = await prisma.dailyPriceBar.findMany({
            where: { stockId: stock.id },
            orderBy: { tradingDate: "desc" },
            take: 60,
            select: { tradingDate: true, openPrice: true, highPrice: true, lowPrice: true, closePrice: true, tradedQty: true },
        });
        // Source records
        const sources = {
            mostActiveVolume: await prisma.mostActiveVolume.findFirst({ where: { tradingDate: date, stockId: stock.id } }),
            mostActiveValue: await prisma.mostActiveValue.findFirst({ where: { tradingDate: date, stockId: stock.id } }),
            volumeGainer: await prisma.volumeGainer.findFirst({ where: { tradingDate: date, stockId: stock.id } }),
            week52High: await prisma.week52High.findFirst({ where: { tradingDate: date, stockId: stock.id } }),
            week52Low: await prisma.week52Low.findFirst({ where: { tradingDate: date, stockId: stock.id } }),
            topGainer: await prisma.topGainer.findFirst({ where: { tradingDate: date, stockId: stock.id } }),
            topLoser: await prisma.topLoser.findFirst({ where: { tradingDate: date, stockId: stock.id } }),
            largeDeals: await prisma.largeDeal.findMany({ where: { tradingDate: date, stockId: stock.id }, take: 50 }),
        };
        res.json(toPlain({ symbol, stock, metric, score, setup, sources, priceBars }));
    }),
    watchlist: asyncHandler(async (req, res) => {
        const dateStr = req.query.date || toDateString(new Date());
        const date = new Date(dateStr + "T00:00:00");
        const mode = req.query.mode === "INTRADAY" || req.query.mode === "SWING" ? req.query.mode : "SWING";
        const run = await getRunForMode(date, mode);
        if (!run)
            return res.json({ tradingDate: dateStr, watchlist: null });
        const wl = await prisma.dailyWatchlist.findUnique({ where: { analysisRunId: run.id }, include: { items: { include: { stock: true, tradeSetup: true }, orderBy: { rank: "asc" } } } });
        res.json(toPlain({ tradingDate: dateStr, mode, watchlist: wl }));
    }),
    history: asyncHandler(async (_req, res) => {
        const days = await prisma.tradingDay.findMany({ orderBy: { tradingDate: "desc" }, take: 120 });
        const out = [];
        for (const d of days) {
            const comp = await completeness(d.tradingDate);
            // Enumerate every distinct snapshot (INTRADAY/EOD) so the user can open
            // each one separately in history.
            const snapshots = await listSnapshotsForDate(d.tradingDate);
            const runs = await prisma.analysisRun.findMany({
                where: { tradingDate: d.tradingDate },
                orderBy: { id: "desc" },
            });
            const snapshotsOut = snapshots.map((s) => {
                const run = runs.find((r) => r.analysisType === s.analysisType);
                return {
                    version: s.version,
                    analysisType: s.analysisType,
                    mode: modeFromAnalysisType(s.analysisType),
                    createdAt: s.createdAtISO,
                    reportCount: s.reportCount,
                    reportTypes: s.reportTypes,
                    uploadIds: s.uploadIds,
                    reports: (s.reports ?? []).map((r) => ({
                        reportType: r.reportType,
                        uploadId: r.uploadId,
                        reusedFrom: r.reusedFrom,
                        reusedFromVersion: r.reusedFromVersion,
                        reused: r.reusedFrom != null,
                    })),
                    analysisStatus: run?.status ?? null,
                    stocksAnalyzed: run?.stocksAnalyzed ?? 0,
                    marketCondition: parseRunMetadata(run?.metadata).marketCondition ?? null,
                    topCandidate: null,
                };
            });
            // Attach the top candidate for the latest run.
            const latestRun = runs[0];
            let topCandidate = null;
            if (latestRun) {
                const top = await prisma.dailyStockScore.findFirst({ where: { analysisRunId: latestRun.id }, orderBy: { rank: "asc" }, include: { stock: true } });
                if (top)
                    topCandidate = { symbol: top.stock.symbol, score: top.normalizedScore };
                for (const s of snapshotsOut) {
                    if (s.analysisType === latestRun.analysisType)
                        s.topCandidate = topCandidate;
                }
            }
            out.push({
                tradingDate: toDateString(d.tradingDate),
                marketStatus: d.marketStatus,
                completeness: comp,
                analysisStatus: latestRun?.status ?? null,
                analysisType: latestRun?.analysisType ?? null,
                stocksAnalyzed: latestRun?.stocksAnalyzed ?? 0,
                topCandidate,
                snapshots: snapshotsOut,
                snapshotCount: snapshotsOut.length,
            });
        }
        res.json(toPlain({ history: out }));
    }),
    chart: asyncHandler(async (req, res) => {
        const symbol = req.params.symbol.toUpperCase();
        const mode = req.query.mode === "INTRADAY" || req.query.mode === "SWING" ? req.query.mode : "SWING";
        const range = (["3M", "6M", "MAX"].includes(req.query.range) ? req.query.range : "6M");
        const chart = await getDailyChart(symbol, { range, mode });
        if (!chart)
            return res.status(404).json({ error: "Stock not found." });
        res.json(toPlain(chart));
    }),
    stockHistory: asyncHandler(async (req, res) => {
        const symbol = req.params.symbol.toUpperCase();
        const stock = await prisma.stock.findUnique({ where: { symbol } });
        if (!stock)
            return res.status(404).json({ error: "Stock not found." });
        const metrics = await prisma.dailyStockMetric.findMany({
            where: { stockId: stock.id },
            orderBy: { tradingDate: "desc" },
            include: { stock: true },
        });
        // attach scores
        const dates = metrics.map((m) => m.tradingDate);
        const runsByDate = await prisma.analysisRun.findMany({ where: { tradingDate: { in: dates } }, orderBy: { id: "desc" } });
        const runByDateMap = new Map(runsByDate.map((r) => [r.tradingDate.toISOString().slice(0, 10), r]));
        const history = [];
        for (const m of metrics) {
            const key = m.tradingDate.toISOString().slice(0, 10);
            const run = runByDateMap.get(key);
            let score = null;
            if (run)
                score = await prisma.dailyStockScore.findFirst({ where: { analysisRunId: run.id, stockId: stock.id } });
            history.push({
                tradingDate: key,
                ltp: m.ltp,
                changePercent: m.changePercent,
                volumeRatio: m.volumeRatio1w,
                is52wHigh: m.is52wHigh,
                is52wLow: m.is52wLow,
                score: score?.normalizedScore ?? null,
                classification: score?.classification ?? null,
                sourceCount: m.sourceCount,
            });
        }
        res.json(toPlain({ symbol, company: stock.companyName, history }));
    }),
};
//# sourceMappingURL=analysisController.js.map