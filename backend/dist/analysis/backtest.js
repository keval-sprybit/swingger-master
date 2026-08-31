// Backtesting engine.
//
// No-look-ahead: every signal is taken from a STORED analysis result computed at
// that sign( trading date ) using only data available up to that date. Outcome
// simulates forward bars AFTER the signal date to measure result, holding
// period, MFE and MAE. Future data is never used to decide the signal.
const MAX_HOLDING_DAYS = 20; // swing cadence cap for a closed outcome
export function runBacktest(signals, barsBySymbol) {
    const trades = [];
    for (const sig of signals) {
        const bars = (barsBySymbol.get(sig.symbol) ?? [])
            .filter((b) => b.tradingDate.getTime() > sig.signalDate.getTime())
            .sort((a, b) => a.tradingDate.getTime() - b.tradingDate.getTime());
        if (bars.length === 0) {
            trades.push({
                signalDate: sig.signalDate.toISOString().slice(0, 10),
                symbol: sig.symbol,
                mode: sig.mode,
                classification: sig.classification,
                score: sig.score,
                entry: sig.entry,
                stop: sig.stop,
                target: sig.target1,
                exitDate: null,
                exitPrice: null,
                result: "OPEN",
                exitReason: null,
                holdingDays: null,
                mfePct: null,
                maePct: null,
                pnlPct: null,
            });
            continue;
        }
        const basePrice = (sig.entry + sig.stop) / 2;
        let mfe = 0;
        let mae = 0;
        let result = "OPEN";
        let exitReason = null;
        let exitPrice = null;
        let exitBar = null;
        for (let i = 0; i < bars.length && i < MAX_HOLDING_DAYS; i++) {
            const b = bars[i];
            const mfePct = b.high > basePrice ? ((b.high - basePrice) / basePrice) * 100 : 0;
            const maePct = b.low < basePrice ? ((basePrice - b.low) / basePrice) * 100 : 0;
            mfe = Math.max(mfe, mfePct);
            mae = Math.max(mae, maePct);
            // Conservative intrabar handling: if a bar touches BOTH stop and target,
            // assume the stop was hit first (worst case), so no-look-ahead and risk
            // discipline are preserved.
            if (b.low <= sig.stop) {
                result = "LOSS";
                exitReason = "STOP";
                exitPrice = sig.stop;
                exitBar = b;
                break;
            }
            if (sig.target1 != null && b.high >= sig.target1) {
                result = "WIN";
                exitReason = "TARGET1";
                exitPrice = sig.target1;
                exitBar = b;
                break;
            }
        }
        if (result === "OPEN") {
            // Time exit at the last available bar close (or last held bar).
            exitBar = bars[Math.min(bars.length - 1, MAX_HOLDING_DAYS - 1)];
            exitPrice = exitBar.close;
            result = sig.target1 != null && exitBar.close >= sig.target1 ? "WIN" : sig.stop > 0 && exitBar.close <= sig.stop ? "LOSS" : "OPEN";
            exitReason = result === "OPEN" ? "TIME" : result === "WIN" ? "TARGET1" : "STOP";
        }
        const holdingDays = exitBar ? bars.indexOf(exitBar) + 1 : null;
        const pnlPct = exitPrice != null && basePrice > 0 ? ((exitPrice - basePrice) / basePrice) * 100 : null;
        trades.push({
            signalDate: sig.signalDate.toISOString().slice(0, 10),
            symbol: sig.symbol,
            mode: sig.mode,
            classification: sig.classification,
            score: sig.score,
            entry: sig.entry,
            stop: sig.stop,
            target: sig.target1,
            exitDate: exitBar ? exitBar.tradingDate.toISOString().slice(0, 10) : null,
            exitPrice,
            result,
            exitReason,
            holdingDays,
            mfePct: round2(mfe),
            maePct: round2(mae),
            pnlPct: pnlPct != null ? round2(pnlPct) : null,
        });
    }
    const metrics = computeMetrics(trades);
    return { trades, metrics };
}
function computeMetrics(trades) {
    const closed = trades.filter((t) => t.result === "WIN" || t.result === "LOSS");
    const wins = closed.filter((t) => t.result === "WIN");
    const losses = closed.filter((t) => t.result === "LOSS");
    const avgW = wins.length ? avg(wins.map((t) => t.pnlPct ?? 0)) : null;
    const avgL = losses.length ? avg(losses.map((t) => t.pnlPct ?? 0)) : null;
    const totalWin = wins.reduce((a, t) => a + (t.pnlPct ?? 0), 0);
    const totalLoss = Math.abs(losses.reduce((a, t) => a + (t.pnlPct ?? 0), 0));
    const rrList = trades.map((t) => (t.entry - t.stop) > 0 ? Math.abs((t.target ?? t.entry) - t.entry) / (t.entry - t.stop) : null).filter((x) => x != null);
    const holding = trades.map((t) => t.holdingDays).filter((x) => x != null);
    const equity = [0];
    for (const t of closed)
        equity.push(equity[equity.length - 1] + (t.pnlPct ?? 0));
    let maxDd = 0;
    let peak = 0;
    for (const e of equity) {
        peak = Math.max(peak, e);
        maxDd = Math.max(maxDd, peak - e);
    }
    return {
        totalTrades: trades.length,
        wins: wins.length,
        losses: losses.length,
        open: trades.length - closed.length,
        winRate: closed.length ? Math.round((wins.length / closed.length) * 1000) / 10 : 0,
        avgWinnerPct: avgW != null ? round2(avgW) : null,
        avgLoserPct: avgL != null ? round2(avgL) : null,
        avgRR: rrList.length ? round2(avg(rrList)) : null,
        profitFactor: totalLoss > 0 ? round2(totalWin / totalLoss) : closed.length ? (totalWin > 0 ? round2(totalWin / (closed.length === wins.length ? 0.0001 : 1)) : 0) : null,
        netPnlPct: round2(closed.reduce((a, t) => a + (t.pnlPct ?? 0), 0)),
        maxDrawdownPct: round2(maxDd),
        avgHoldingDays: holding.length ? round2(avg(holding)) : null,
    };
}
function avg(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function round2(x) {
    return Math.round(x * 100) / 100;
}
//# sourceMappingURL=backtest.js.map