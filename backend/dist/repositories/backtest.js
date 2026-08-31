import { prisma } from "../prisma.js";
export async function createBacktestRun(params) {
    return prisma.backtestRun.create({
        data: {
            label: params.label ?? null,
            mode: params.mode,
            totalTrades: params.metrics.totalTrades,
            wins: params.metrics.wins,
            losses: params.metrics.losses,
            open: params.metrics.open,
            winRate: params.metrics.winRate ?? null,
            avgWinnerPct: params.metrics.avgWinnerPct ?? null,
            avgLoserPct: params.metrics.avgLoserPct ?? null,
            avgRR: params.metrics.avgRR ?? null,
            profitFactor: params.metrics.profitFactor ?? null,
            netPnlPct: params.metrics.netPnlPct ?? null,
            maxDrawdownPct: params.metrics.maxDrawdownPct ?? null,
            avgHoldingDays: params.metrics.avgHoldingDays ?? null,
        },
    });
}
export async function insertBacktestTrade(runId, t) {
    return prisma.backtestTrade.create({
        data: {
            runId,
            symbol: t.symbol,
            signalDate: t.signalDate,
            mode: t.mode,
            classification: t.classification ?? null,
            score: t.score ?? null,
            entry: t.entry,
            stop: t.stop,
            target: t.target ?? null,
            exitDate: t.exitDate ?? null,
            exitPrice: t.exitPrice ?? null,
            result: t.result,
            exitReason: t.exitReason ?? null,
            holdingDays: t.holdingDays ?? null,
            mfePct: t.mfePct ?? null,
            maePct: t.maePct ?? null,
            pnlPct: t.pnlPct ?? null,
        },
    });
}
//# sourceMappingURL=backtest.js.map