import { prisma } from "../prisma.js";
import { AnalysisType, AnalysisStatus, SetupStatus } from "@prisma/client";
import { computeSignals } from "../analysis/signals.js";
import { computeTradeSetup } from "../analysis/setup.js";
import { MetricInput } from "../analysis/types.js";
import { getSettings } from "../repositories/settings.js";
import {
  createAnalysisRun,
  finalizeAnalysisRun,
  clearRunOutputs,
  insertScore,
  insertSetup,
  createWatchlist,
} from "../repositories/analysis.js";
import { ensureTradingDay } from "../repositories/metrics.js";
import { REQUIRED_REPORTS } from "../config/index.js";
import { toDateString } from "../utils/date.js";

const ACTIONABLE: string[] = ["BUY_SETUP", "WAIT_FOR_BREAKOUT", "WAIT_FOR_PULLBACK", "WATCH"];

function nextBusinessDay(date: Date): Date {
  const d = new Date(date);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface RunAnalysisResult {
  runId: number;
  tradingDate: string;
  nextTradingDate: string;
  analysisType: string;
  status: string;
  stocksAnalyzed: number;
  filesReceived: number;
  filesExpected: number;
  watchlistSize: number;
}

export async function runAnalysis(
  tradingDateInput: string,
  analysisType: "EOD" | "PRE_MARKET" | "INTRADAY" = "EOD"
): Promise<RunAnalysisResult> {
  const tradingDate = new Date(tradingDateInput + "T00:00:00");
  if (isNaN(tradingDate.getTime())) throw new Error("Invalid trading date");
  await ensureTradingDay(tradingDate);

  const uploads = await prisma.csvUpload.findMany({
    where: { tradingDate, uploadStatus: "PROCESSED" },
    select: { reportType: true },
  });
  const receivedTypes = new Set(uploads.map((u) => u.reportType));
  const filesReceived = REQUIRED_REPORTS.filter((r) => receivedTypes.has(r as any)).length;
  const filesExpected = REQUIRED_REPORTS.length;
  const complete = filesReceived >= filesExpected;

  const typeEnum: AnalysisType =
    analysisType === "INTRADAY"
      ? AnalysisType.INTRADAY
      : analysisType === "PRE_MARKET"
      ? AnalysisType.PRE_MARKET
      : AnalysisType.EOD;

  const run = await createAnalysisRun({ tradingDate, analysisType: typeEnum, filesExpected, filesReceived });

  try {
    const settings = await getSettings();

    const metrics = await prisma.dailyStockMetric.findMany({
      where: { tradingDate },
      include: { stock: true },
    });

    // Previous trading day metrics for technical levels (breakout/stop)
    const prevMeta = await prisma.dailyStockMetric.findFirst({
      where: { tradingDate: { lt: tradingDate } },
      orderBy: { tradingDate: "desc" },
      select: { tradingDate: true },
    });
    const prevMap = new Map<number, any>();
    if (prevMeta) {
      const prevMetrics = await prisma.dailyStockMetric.findMany({ where: { tradingDate: prevMeta.tradingDate } });
      for (const pm of prevMetrics) prevMap.set(pm.stockId, pm);
    }

    const entries: {
      stockId: number;
      symbol: string;
      companyName: string | null;
      score: ReturnType<typeof computeSignals>;
      setup: ReturnType<typeof computeTradeSetup>;
    }[] = [];

    let warningCount = 0;
    for (const m of metrics) {
      const prev = prevMap.get(m.stockId);
      const input: MetricInput = {
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
      };
      const score = computeSignals(input);
      const setup = computeTradeSetup(input, score, {
        capital: settings.capital,
        riskPercent: settings.riskPercent,
        minRiskReward: settings.minRiskReward,
      });
      if (score.warnings.length > 0) warningCount += score.warnings.length;
      entries.push({ stockId: m.stockId, symbol: m.stock.symbol, companyName: m.stock.companyName, score, setup });
    }

    // Rank by normalized score desc, then turnover
    entries.sort((a, b) => {
      if (b.score.normalizedScore !== a.score.normalizedScore) return b.score.normalizedScore - a.score.normalizedScore;
      const ta = metrics.find((m) => m.stockId === a.stockId)?.turnover ?? 0;
      const tb = metrics.find((m) => m.stockId === b.stockId)?.turnover ?? 0;
      return Number(tb) - Number(ta);
    });

    await clearRunOutputs(run.id);

    const setupIdByStock = new Map<number, number>();
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const rank = i + 1;
      await insertScore({ runId: run.id, tradingDate, stockId: e.stockId, score: e.score, rank });
      const setupRec = await insertSetup({ runId: run.id, tradingDate, stockId: e.stockId, setup: e.setup });
      setupIdByStock.set(e.stockId, setupRec.id);
    }

    // Build watchlist from actionable candidates
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
        score: e.score.normalizedScore,
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

    return {
      runId: run.id,
      tradingDate: toDateString(tradingDate),
      nextTradingDate: toDateString(nextTradingDate),
      analysisType,
      status: complete ? "COMPLETED" : "PARTIAL",
      stocksAnalyzed: entries.length,
      filesReceived,
      filesExpected,
      watchlistSize: actionable.length,
    };
  } catch (err: any) {
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
