import { prisma } from "../prisma.js";
import { runBacktest } from "../analysis/backtest.js";
import { createBacktestRun, insertBacktestTrade } from "../repositories/backtest.js";
import { loadPriceBarsForSymbols } from "../repositories/priceHistory.js";
// Trades are only simulated where the rules would actually have taken one:
// confirmed breakouts with acceptable risk/reward (ENTRY ACTIVE or
// BREAKOUT CONFIRMED). Early "approaching / wait" states are NOT trades.
const TRADING_STATUSES = ["ENTRY_ACTIVE", "BREAKOUT_CONFIRMED"];
export async function runBacktestForRange(fromDate, toDate, mode, label) {
    const from = new Date(fromDate + "T00:00:00");
    const to = new Date(toDate + "T00:00:00");
    if (isNaN(from.getTime()) || isNaN(to.getTime()))
        throw new Error("Invalid date range");
    if (from > to)
        throw new Error("fromDate must be <= toDate");
    const setups = await prisma.tradeSetup.findMany({
        where: {
            mode,
            tradingDate: { gte: from, lte: to },
            status: { in: TRADING_STATUSES },
            entryLow: { not: null },
            stopLoss: { not: null },
        },
        include: { stock: true },
        orderBy: { tradingDate: "asc" },
    });
    const signals = setups.map((s) => ({
        signalDate: s.tradingDate,
        symbol: s.stock.symbol,
        mode,
        classification: null,
        score: s.explainableScore != null ? Number(s.explainableScore) : null,
        setupType: s.setupType,
        marketCondition: s.marketCondition ?? null,
        entry: Number(s.entryLow),
        stop: Number(s.stopLoss),
        target1: s.target1 != null ? Number(s.target1) : null,
        target2: s.target2 != null ? Number(s.target2) : null,
        quantity: s.recommendedQuantity ?? 0,
    }));
    const symbols = [...new Set(signals.map((s) => s.symbol))];
    const barsBySymbol = await loadPriceBarsForSymbols(symbols);
    const { trades, metrics } = runBacktest(signals, barsBySymbol);
    const run = await createBacktestRun({ label: label ?? `${mode} backtest`, mode, metrics });
    for (const t of trades) {
        await insertBacktestTrade(run.id, {
            symbol: t.symbol,
            signalDate: new Date(t.signalDate + "T00:00:00"),
            mode,
            classification: t.classification ?? null,
            score: t.score ?? null,
            entry: t.entry,
            stop: t.stop,
            target: t.target,
            exitDate: t.exitDate ? new Date(t.exitDate + "T00:00:00") : null,
            exitPrice: t.exitPrice,
            result: t.result,
            exitReason: t.exitReason,
            holdingDays: t.holdingDays,
            mfePct: t.mfePct,
            maePct: t.maePct,
            pnlPct: t.pnlPct,
        });
    }
    return { runId: run.id, mode, from: fromDate, to: toDate, metrics, trades };
}
export async function listBacktestRuns() {
    return prisma.backtestRun.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
}
export async function getBacktestRun(id) {
    return prisma.backtestRun.findUnique({ where: { id }, include: { trades: { orderBy: { signalDate: "asc" } } } });
}
//# sourceMappingURL=backtestService.js.map