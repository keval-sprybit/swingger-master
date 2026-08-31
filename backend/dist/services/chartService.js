// Chart data service.
//
// Builds the data payload for the candlestick / volume price chart used by the
// Candidate Detail page. It is the SOURCE OF TRUTH for what the chart draws:
//   - Real daily OHLC bars from stored NSE Bhavcopy (DailyPriceBar)
//   - SMA20 / SMA50 / SMA200 series computed from those same bars (never fake)
//   - Data-availability flags so the UI can show "Insufficient data" instead of
//     inventing lines
//
// The analysis levels (breakout, entry, stop, targets, support, resistance)
// are NOT recomputed here — they come from the stored TradeSetup so the chart
// always agrees with the analysis page.
import { prisma } from "../prisma.js";
import { loadPriceBars } from "../repositories/priceHistory.js";
const RANGE_DAYS = {
    "3M": 66, // ~3 months of trading days
    "6M": 132, // ~6 months
    MAX: 260, // max useful daily history the app loads
};
// Compute a rolling SMA series over close prices, oldest -> newest.
// Values are null until `period` closes are available (never interpolated).
export function smaSeries(closes, period) {
    const out = new Array(closes.length).fill(null);
    let sum = 0;
    for (let i = 0; i < closes.length; i++) {
        sum += closes[i];
        if (i >= period)
            sum -= closes[i - period];
        if (i >= period - 1)
            out[i] = sum / period;
    }
    return out;
}
function toNum(v, fallback) {
    if (v === null || v === undefined)
        return fallback;
    if (typeof v === "number")
        return v;
    // Prisma Decimal / string
    const n = typeof v?.toNumber === "function" ? v.toNumber() : Number(v);
    return Number.isFinite(n) ? n : fallback;
}
export async function getDailyChart(symbol, opts = {}) {
    const stock = await prisma.stock.findUnique({ where: { symbol } });
    if (!stock)
        return null;
    const range = opts.range && RANGE_DAYS[opts.range] ? opts.range : "6M";
    const limit = RANGE_DAYS[range];
    let bars = [];
    // For INTRADAY mode there are no stored intraday candles; we still serve the
    // daily bars (clearly labelled EOD) so the user can see price context, and set
    // intradayAvailable=false so the UI shows "Intraday candle chart unavailable".
    if (opts.mode !== "INTRADAY") {
        bars = await loadPriceBars(stock.id, limit);
    }
    else {
        bars = await loadPriceBars(stock.id, limit);
    }
    // Compute the trade setup levels from the most recent analysis run so the
    // chart perfectly matches the analysis page (single source of truth).
    let levels = {
        currentPrice: null, breakout: null, entryLow: null, entryHigh: null,
        stopLoss: null, target1: null, target2: null, riskReward1: null,
    };
    let status = null;
    let breakoutStatus = null;
    let insufficientData = true;
    let indicators = {
        sma20: null, sma50: null, sma200: null, rsi14: null, atr14: null,
        relVolume: null, trend: null, support: null, resistance: null,
    };
    const latestRun = await prisma.analysisRun.findFirst({
        where: { tradingDate: { lte: new Date() } },
        orderBy: [{ tradingDate: "desc" }, { id: "desc" }],
        select: { id: true, tradingDate: true },
    });
    if (latestRun) {
        const setup = await prisma.tradeSetup.findFirst({
            where: { analysisRunId: latestRun.id, stockId: stock.id },
        });
        if (setup) {
            status = setup.status;
            breakoutStatus = setup.breakoutStatus ?? null;
            insufficientData = setup.insufficientData || status === "INSUFFICIENT_DATA";
            const tc = setup.technicalContext ?? {};
            indicators = {
                sma20: tc.sma20 != null ? toNum(tc.sma20, NaN) : null,
                sma50: tc.sma50 != null ? toNum(tc.sma50, NaN) : null,
                sma200: tc.sma200 != null ? toNum(tc.sma200, NaN) : null,
                rsi14: tc.rsi14 != null ? toNum(tc.rsi14, NaN) : null,
                atr14: tc.atr14 != null ? toNum(tc.atr14, NaN) : null,
                relVolume: tc.relVolume != null ? toNum(tc.relVolume, NaN) : null,
                trend: setup.trend ?? tc.trend ?? null,
                support: tc.support != null ? toNum(tc.support, NaN) : null,
                resistance: tc.resistance != null ? toNum(tc.resistance, NaN) : null,
            };
            levels = {
                currentPrice: setup.currentPrice != null ? toNum(setup.currentPrice, NaN) : null,
                breakout: setup.breakoutLevel != null ? toNum(setup.breakoutLevel, NaN) : null,
                entryLow: setup.entryLow != null ? toNum(setup.entryLow, NaN) : null,
                entryHigh: setup.entryHigh != null ? toNum(setup.entryHigh, NaN) : null,
                stopLoss: setup.stopLoss != null ? toNum(setup.stopLoss, NaN) : null,
                target1: setup.target1 != null ? toNum(setup.target1, NaN) : null,
                target2: setup.target2 != null ? toNum(setup.target2, NaN) : null,
                riskReward1: setup.riskReward1 != null ? toNum(setup.riskReward1, NaN) : null,
            };
        }
    }
    // Fall back to indicators computed from the bars themselves if no setup exists,
    // so the chart still shows SOMAs when a setup hasn't been persisted yet.
    const closes = bars.map((b) => b.close);
    const sma20 = smaSeries(closes, 20);
    const sma50 = smaSeries(closes, 50);
    const sma200 = smaSeries(closes, 200);
    if (!indicators.sma20)
        indicators.sma20 = sma20[sma20.length - 1] ?? null;
    if (!indicators.sma50)
        indicators.sma50 = sma50[sma50.length - 1] ?? null;
    if (!indicators.sma200)
        indicators.sma200 = sma200[sma200.length - 1] ?? null;
    const points = bars.map((b, i) => ({
        tradingDate: b.tradingDate.toISOString().slice(0, 10),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
        sma20: sma20[i],
        sma50: sma50[i],
        sma200: sma200[i],
    }));
    const lastBar = bars[bars.length - 1];
    return {
        symbol,
        tradingDate: lastBar ? lastBar.tradingDate.toISOString().slice(0, 10) : null,
        dataType: "EOD",
        dataTime: null,
        bars: points,
        availableDays: bars.length,
        indicators,
        levels,
        status,
        breakoutStatus,
        insufficientData,
        intradayAvailable: false, // this app stores daily EOD bars, not intraday candles
    };
}
//# sourceMappingURL=chartService.js.map