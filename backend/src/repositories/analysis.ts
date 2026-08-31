import { prisma } from "../prisma.js";
import { AnalysisType, AnalysisStatus, ScoreClass, SetupStatus } from "@prisma/client";
import { ScoreResult, TradeSetupResult } from "../analysis/types.js";

export async function createAnalysisRun(params: {
  tradingDate: Date;
  analysisType: AnalysisType;
  filesExpected: number;
  filesReceived: number;
}) {
  // Re-run safety: exactly one result per (tradingDate, analysisType). Any
  // prior run for the same date + analysis type is replaced (its outputs are
  // cleared before the run row is deleted because the FKs are RESTRICT).
  const prior = await prisma.analysisRun.findFirst({
    where: { tradingDate: params.tradingDate, analysisType: params.analysisType },
    orderBy: { id: "desc" },
  });
  if (prior) {
    await clearRunOutputs(prior.id);
    await prisma.analysisRun.delete({ where: { id: prior.id } });
  }
  return prisma.analysisRun.create({
    data: {
      tradingDate: params.tradingDate,
      analysisType: params.analysisType,
      status: AnalysisStatus.RUNNING,
      filesExpected: params.filesExpected,
      filesReceived: params.filesReceived,
    },
  });
}

export async function finalizeAnalysisRun(
  id: number,
  data: {
    status: AnalysisStatus;
    stocksAnalyzed: number;
    errorCount: number;
    warningCount: number;
    errorMessage?: string | null;
  }
) {
  return prisma.analysisRun.update({
    where: { id },
    data: {
      status: data.status,
      stocksAnalyzed: data.stocksAnalyzed,
      errorCount: data.errorCount,
      warningCount: data.warningCount,
      errorMessage: data.errorMessage ?? null,
      completedAt: new Date(),
    },
  });
}

// Remove any prior outputs for a run (idempotent re-run)
export async function clearRunOutputs(runId: number) {
  await prisma.watchlistItem.deleteMany({ where: { watchlist: { analysisRunId: runId } } });
  await prisma.dailyWatchlist.deleteMany({ where: { analysisRunId: runId } });
  await prisma.tradeSetup.deleteMany({ where: { analysisRunId: runId } });
  await prisma.dailyStockScore.deleteMany({ where: { analysisRunId: runId } });
}

export async function insertScore(params: {
  runId: number;
  tradingDate: Date;
  stockId: number;
  score: ScoreResult;
  rank: number;
}) {
  const s = params.score;
  const classification = s.classification as ScoreClass;
  return prisma.dailyStockScore.create({
    data: {
      analysisRunId: params.runId,
      tradingDate: params.tradingDate,
      stockId: params.stockId,
      activityVolumeScore: s.activityVolumeScore,
      activityValueScore: s.activityValueScore,
      volumeExpansionScore: s.volumeExpansionScore,
      momentumScore: s.momentumScore,
      week52Score: s.week52Score,
      gainerScore: s.gainerScore,
      loserScore: s.loserScore,
      liquidityScore: s.liquidityScore,
      largeDealScore: s.largeDealScore,
      priceActionScore: s.priceActionScore,
      riskPenalty: s.riskPenalty,
      rawScore: s.rawScore,
      normalizedScore: s.normalizedScore,
      rank: params.rank,
      classification,
      signals: s.signals as any,
    },
  });
}

export async function insertSetup(params: {
  runId: number;
  tradingDate: Date;
  stockId: number;
  setup: TradeSetupResult;
  mode?: "INTRADAY" | "SWING";
  explainable?: { total: number; components: { key: string; label: string; score: number; max: number; reason: string }[] } | null;
  technicalContext?: Record<string, unknown> | null;
}) {
  const st = params.setup;
  return prisma.tradeSetup.create({
    data: {
      analysisRunId: params.runId,
      tradingDate: params.tradingDate,
      stockId: params.stockId,
      setupType: st.setupType,
      status: st.status as SetupStatus,
      mode: params.mode ?? st.mode ?? "SWING",
      currentPrice: st.currentPrice,
      breakoutLevel: st.breakoutLevel,
      entryLow: st.entryLow,
      entryHigh: st.entryHigh,
      stopLoss: st.stopLoss,
      target1: st.target1,
      target2: st.target2,
      riskPerShare: st.riskPerShare,
      reward1PerShare: st.reward1PerShare,
      reward2PerShare: st.reward2PerShare,
      riskReward1: st.riskReward1,
      riskReward2: st.riskReward2,
      capitalAvailable: st.capitalAvailable,
      riskPercent: st.riskPercent,
      maximumRisk: st.maximumRisk,
      recommendedQuantity: st.recommendedQuantity,
      capitalUsed: st.capitalUsed,
      maximumLoss: st.maximumLoss,
      triggerCondition: st.triggerCondition,
      invalidationCondition: st.invalidationCondition,
      reason: st.reason,
      warnings: st.warnings as any,
      confidenceScore: st.confidenceScore,
      breakoutReason: st.breakoutReason,
      breakoutStatus: st.breakoutStatus,
      stopLossReason: st.stopLossReason,
      target1Reason: st.target1Reason,
      trend: st.trend,
      trendReasons: (st.trendReasons ?? null) as any,
      marketCondition: st.marketCondition ?? null,
      whySelected: (st.whySelected ?? null) as any,
      insufficientData: st.insufficientData ?? false,
      explainableScore: params.explainable?.total ?? null,
      explainableJson: params.explainable ? (params.explainable as any) : null,
      technicalContext: (params.technicalContext ?? null) as any,
    },
  });
}

export async function createWatchlist(params: {
  runId: number;
  tradingDate: Date;
  nextTradingDate: Date;
  items: { stockId: number; rank: number; score: number; status: string; tradeSetupId: number | null; reason: string }[];
}) {
  const wl = await prisma.dailyWatchlist.create({
    data: {
      tradingDate: params.tradingDate,
      nextTradingDate: params.nextTradingDate,
      analysisRunId: params.runId,
      status: "ACTIVE",
    },
  });
  if (params.items.length > 0) {
    await prisma.watchlistItem.createMany({
      data: params.items.map((it) => ({
        watchlistId: wl.id,
        stockId: it.stockId,
        rank: it.rank,
        score: it.score,
        status: it.status as SetupStatus,
        tradeSetupId: it.tradeSetupId,
        reason: it.reason,
      })),
    });
  }
  return wl;
}
