import { prisma } from "../prisma.js";
import { AnalysisType, AnalysisStatus } from "@prisma/client";
import { computeSignals } from "../analysis/signals.js";
import { computeIndicators } from "../analysis/technical.js";
import { computeStructure } from "../analysis/structure.js";
import { classifyMarket } from "../analysis/market.js";
import { computeExplainableScore } from "../analysis/scoring.js";
import { getSettings } from "../repositories/settings.js";
import { createAnalysisRun, finalizeAnalysisRun, clearRunOutputs, insertScore, insertSetup, createWatchlist, } from "../repositories/analysis.js";
import { loadPriceBarsForStockIds, loadPriceBarsForSymbols } from "../repositories/priceHistory.js";
import { ensureTradingDay } from "../repositories/metrics.js";
import { REQUIRED_REPORTS } from "../config/index.js";
import { toDateString } from "../utils/date.js";
// Two-mode system:
//   - EOD / PRE_MARKET  => SWING mode  (NEXT SESSION SWING ANALYSIS)
//   - INTRADAY          => INTRADAY mode (TODAY'S INTRADAY ANALYSIS)
function modeForAnalysisType(t) {
    return t === "INTRADAY" ? "INTRADAY" : "SWING";
}
const INDEX_SYMBOLS = ["NIFTY", "NIFTY50", "NIFTY 50", "BANKNIFTY", "BANK NIFTY", "FINNIFTY", "SENSEX", "NIFTYMID50"];
// Conservative actionable statuses -> these make the trade watchlist.
// MISSED (chase), AVOID, WEAK_BREAKOUT, NO_TRADE, INSUFFICIENT_DATA are excluded.
const ACTIONABLE = [
    "ENTRY_ACTIVE",
    "BREAKOUT_CONFIRMED",
    "BREAKOUT_APPROACHING",
    "WAIT_FOR_BREAKOUT",
];
function nextBusinessDay(date) {
    const d = new Date(date);
    do {
        d.setDate(d.getDate() + 1);
    } while (d.getDay() === 0 || d.getDay() === 6);
    d.setHours(0, 0, 0, 0);
    return d;
}
export async function runAnalysis(tradingDateInput, analysisType = "EOD", modeOverride) {
    const tradingDate = new Date(tradingDateInput + "T00:00:00");
    if (isNaN(tradingDate.getTime()))
        throw new Error("Invalid trading date");
    await ensureTradingDay(tradingDate);
    const uploads = await prisma.csvUpload.findMany({
        where: { tradingDate, uploadStatus: "PROCESSED" },
        select: { reportType: true },
    });
    const receivedTypes = new Set(uploads.map((u) => u.reportType));
    const filesReceived = REQUIRED_REPORTS.filter((r) => receivedTypes.has(r)).length;
    const filesExpected = REQUIRED_REPORTS.length;
    const complete = filesReceived >= filesExpected;
    const mode = modeOverride ?? modeForAnalysisType(analysisType);
    const typeEnum = analysisType === "INTRADAY"
        ? AnalysisType.INTRADAY
        : analysisType === "PRE_MARKET"
            ? AnalysisType.PRE_MARKET
            : AnalysisType.EOD;
    const run = await createAnalysisRun({ tradingDate, analysisType: typeEnum, filesExpected, filesReceived });
    try {
        const settings = await getSettings();
        const setupSettings = {
            capital: settings.capital,
            riskPercent: settings.riskPercent,
            minRiskReward: settings.minRiskReward,
        };
        const metrics = await prisma.dailyStockMetric.findMany({
            where: { tradingDate },
            include: { stock: true },
        });
        // Previous trading day metrics for technical levels (breakout/stop fallback)
        const prevMeta = await prisma.dailyStockMetric.findFirst({
            where: { tradingDate: { lt: tradingDate } },
            orderBy: { tradingDate: "desc" },
            select: { tradingDate: true },
        });
        const prevMap = new Map();
        if (prevMeta) {
            const prevMetrics = await prisma.dailyStockMetric.findMany({ where: { tradingDate: prevMeta.tradingDate } });
            for (const pm of prevMetrics)
                prevMap.set(pm.stockId, pm);
        }
        // ---- Market condition (index-backed when available, else breadth proxy) --
        const indexBarsBySymbol = await loadPriceBarsForSymbols(INDEX_SYMBOLS);
        const indexSubset = Array.from(indexBarsBySymbol.entries()).map(([sym, bars]) => {
            const tech = computeIndicators(bars);
            return {
                symbol: sym,
                return20d: tech.return20d,
                return5d: tech.return5d,
                above20dma: tech.sma20 != null ? bars[bars.length - 1].close > tech.sma20 : null,
            };
        });
        const advancers = metrics.filter((m) => m.changePercent != null && Number(m.changePercent) > 0).length;
        const decliners = metrics.filter((m) => m.changePercent != null && Number(m.changePercent) <= 0).length;
        const week52High = metrics.filter((m) => m.is52wHigh).length;
        const week52Low = metrics.filter((m) => m.is52wLow).length;
        const market = classifyMarket({
            indexSubset: indexSubset.length > 0 ? indexSubset : null,
            advancers,
            decliners,
            week52High,
            week52Low,
        });
        // ---- Bhavcopy history for all stocks in this run ----------------------
        const stockIds = metrics.map((m) => m.stockId);
        const barsByStock = await loadPriceBarsForStockIds(stockIds);
        const entries = [];
        let warningCount = 0;
        for (const m of metrics) {
            const prev = prevMap.get(m.stockId);
            const bars = barsByStock.get(m.stockId) ?? [];
            const tech = bars.length > 0 ? computeIndicators(bars) : null;
            const input = {
                stockId: m.stockId,
                symbol: m.stock.symbol,
                ltp: m.ltp === null ? null : Number(m.ltp),
                changePercent: m.changePercent === null ? null : Number(m.changePercent),
                volume: m.volume,
                turnover: m.turnover === null ? null : Number(m.turnover),
                volumeRatio1w: m.volumeRatio1w === null ? null : Number(m.volumeRatio1w),
                volumeRatio2w: m.volumeRatio2w === null ? null : Number(m.volumeRatio2w),
                closePosition: m.closePosition === null ? null : Number(m.closePosition),
                dayRange: m.dayRange === null ? null : Number(m.dayRange),
                previousClose: m.previousClose === null ? null : Number(m.previousClose),
                highPrice: m.highPrice === null ? null : Number(m.highPrice),
                lowPrice: m.lowPrice === null ? null : Number(m.lowPrice),
                openPrice: m.openPrice === null ? null : Number(m.openPrice),
                isMostActiveVolume: m.isMostActiveVolume,
                isMostActiveValue: m.isMostActiveValue,
                isVolumeGainer: m.isVolumeGainer,
                is52wHigh: m.is52wHigh,
                is52wLow: m.is52wLow,
                isTopGainer: m.isTopGainer,
                isTopLoser: m.isTopLoser,
                bulkBuyQuantity: m.bulkBuyQuantity,
                bulkSellQuantity: m.bulkSellQuantity,
                bulkNetQuantity: m.bulkNetQuantity,
                prevHighPrice: prev?.highPrice != null ? Number(prev.highPrice) : null,
                prevLowPrice: prev?.lowPrice != null ? Number(prev.lowPrice) : null,
                prevClose: prev?.previousClose != null ? Number(prev.previousClose) : null,
                breakoutLevel: tech?.breakoutLevel ?? null,
                breakoutReason: tech?.breakoutReason ?? null,
                marketCondition: market.condition,
            };
            const score = computeSignals(input);
            const setup = computeStructure({
                metric: input,
                score,
                tech,
                marketCondition: market.condition,
                mode,
                settings: setupSettings,
            });
            const explainable = computeExplainableScore({
                mode,
                metric: input,
                tech,
                marketCondition: market.condition,
                setup: setup,
                dataQuality: tech ? Math.min(1, tech.availableDays / 60) : 0,
            });
            warningCount += score.warnings.length + explainable.warnings.length;
            entries.push({ stockId: m.stockId, symbol: m.stock.symbol, companyName: m.stock.companyName, score, setup, tech, explainable });
        }
        // Rank by transparent explainable score desc, then legacy score, then turnover.
        entries.sort((a, b) => {
            if (b.explainable.total !== a.explainable.total)
                return b.explainable.total - a.explainable.total;
            if (b.score.normalizedScore !== a.score.normalizedScore)
                return Number(b.score.normalizedScore) - Number(a.score.normalizedScore);
            const ta = metrics.find((m) => m.stockId === a.stockId)?.turnover ?? 0;
            const tb = metrics.find((m) => m.stockId === b.stockId)?.turnover ?? 0;
            return Number(tb) - Number(ta);
        });
        await clearRunOutputs(run.id);
        const setupIdByStock = new Map();
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            const rank = i + 1;
            await insertScore({ runId: run.id, tradingDate, stockId: e.stockId, score: e.score, rank });
            const setupRec = await insertSetup({
                runId: run.id,
                tradingDate,
                stockId: e.stockId,
                setup: e.setup,
                mode,
                explainable: e.explainable,
                technicalContext: e.tech
                    ? {
                        availableDays: e.tech.availableDays,
                        sma20: e.tech.sma20,
                        sma50: e.tech.sma50,
                        sma200: e.tech.sma200,
                        rsi14: e.tech.rsi14,
                        atr14: e.tech.atr14,
                        relVolume: e.tech.relVolume,
                        high20: e.tech.high20,
                        low20: e.tech.low20,
                        high50: e.tech.high50,
                        low50: e.tech.low50,
                        breakoutLevel: e.tech.breakoutLevel,
                        breakoutReason: e.tech.breakoutReason,
                        trend: e.tech.trend,
                        trendReasons: e.tech.trendReasons,
                    }
                    : null,
            });
            setupIdByStock.set(e.stockId, setupRec.id);
        }
        // Build watchlist from conservative actionable candidates.
        const actionable = entries
            .filter((e) => ACTIONABLE.includes(e.setup.status))
            .slice(0, settings.maxWatchlistSize);
        const nextTradingDate = nextBusinessDay(tradingDate);
        await createWatchlist({
            runId: run.id,
            tradingDate,
            nextTradingDate,
            items: actionable.map((e, idx) => ({
                stockId: e.stockId,
                rank: idx + 1,
                score: e.explainable.total,
                status: e.setup.status,
                tradeSetupId: setupIdByStock.get(e.stockId) ?? null,
                reason: e.setup.reason ?? "",
            })),
        });
        await finalizeAnalysisRun(run.id, {
            status: complete ? AnalysisStatus.COMPLETED : AnalysisStatus.PARTIAL,
            stocksAnalyzed: entries.length,
            errorCount: 0,
            warningCount,
            errorMessage: complete ? null : `Only ${filesReceived}/${filesExpected} reports available. Partial analysis.`,
        });
        // Record market condition + mode on the run for the UI.
        await prisma.analysisRun.update({
            where: { id: run.id },
            data: { metadata: { mode, marketCondition: market.condition, marketReason: market.reason } },
        });
        return {
            runId: run.id,
            tradingDate: toDateString(tradingDate),
            nextTradingDate: toDateString(nextTradingDate),
            analysisType,
            mode,
            status: complete ? "COMPLETED" : "PARTIAL",
            stocksAnalyzed: entries.length,
            filesReceived,
            filesExpected,
            watchlistSize: actionable.length,
            marketCondition: market.condition,
        };
    }
    catch (err) {
        await finalizeAnalysisRun(run.id, {
            status: AnalysisStatus.FAILED,
            stocksAnalyzed: 0,
            errorCount: 1,
            warningCount: 0,
            errorMessage: String(err?.message ?? err),
        });
        throw err;
    }
}
//# sourceMappingURL=analysisService.js.map