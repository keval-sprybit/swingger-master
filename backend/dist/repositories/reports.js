import { prisma } from "../prisma.js";
import { ReportType } from "@prisma/client";
import { upsertStock } from "./stocks.js";
const CHUNK = 500;
function dec(v) {
    return v === undefined || v === null || Number.isNaN(v) ? null : v;
}
function big(v) {
    return v === undefined || v === null ? null : v;
}
export async function saveReportRows(reportType, tradingDate, uploadId, rows) {
    if (rows.length === 0)
        return 0;
    // Bhavcopy is stored separately as daily price-volume history (DailyPriceBar),
    // not as a screening-report row set. Two-store it via upsert per (stock, date).
    if (reportType === ReportType.BHAVCOPY) {
        return saveBhavcopyRows(tradingDate, uploadId, rows);
    }
    // Ensure all stocks exist
    const symbols = [...new Set(rows.map((r) => r.symbol))];
    const symbolToId = new Map();
    for (const s of symbols) {
        const id = await upsertStock(s, {
            companyName: rows.find((r) => r.symbol === s)?.security ?? null,
            series: rows.find((r) => r.symbol === s)?.series ?? null,
        });
        symbolToId.set(s, id);
    }
    const records = [];
    for (const r of rows) {
        const stockId = symbolToId.get(r.symbol);
        if (stockId === undefined)
            continue;
        const base = { tradingDate, uploadId, stockId, symbol: r.symbol };
        switch (reportType) {
            case "MOST_ACTIVE_VOLUME":
            case "MOST_ACTIVE_VALUE":
                records.push({
                    ...base,
                    openPrice: dec(r.openPrice),
                    highPrice: dec(r.highPrice),
                    lowPrice: dec(r.lowPrice),
                    previousClose: dec(r.previousClose),
                    ltp: dec(r.ltp),
                    changePercent: dec(r.changePercent),
                    volume: big(r.volume),
                    turnover: dec(r.turnover),
                    corporateAction: r.corporateAction ?? null,
                });
                break;
            case "VOLUME_GAINERS":
                records.push({
                    ...base,
                    securityName: r.security ?? null,
                    todayVolume: big(r.todayVolume),
                    avgVolume1w: big(r.avgVolume1w),
                    volumeChange1w: dec(r.volumeChange1w),
                    avgVolume2w: big(r.avgVolume2w),
                    volumeChange2w: dec(r.volumeChange2w),
                    todayLtp: dec(r.todayLtp),
                    todayChangePercent: dec(r.todayChangePercent),
                    todayTurnover: dec(r.todayTurnover),
                    volumeRatio1w: dec(r.volumeRatio1w),
                    volumeRatio2w: dec(r.volumeRatio2w),
                });
                break;
            case "WEEK52_HIGH":
                records.push({
                    ...base,
                    series: r.series ?? null,
                    ltp: dec(r.ltp),
                    changePercent: dec(r.changePercent),
                    new52wHigh: dec(r.new52wHigh),
                    previousHigh: dec(r.previousHigh),
                    previousHighDate: r.previousHighDate ?? null,
                });
                break;
            case "WEEK52_LOW":
                records.push({
                    ...base,
                    series: r.series ?? null,
                    ltp: dec(r.ltp),
                    changePercent: dec(r.changePercent),
                    new52wLow: dec(r.new52wLow),
                    previousLow: dec(r.previousLow),
                    previousLowDate: r.previousLowDate ?? null,
                });
                break;
            case "TOP_GAINERS":
            case "TOP_LOSERS":
                records.push({
                    ...base,
                    openPrice: dec(r.openPrice),
                    highPrice: dec(r.highPrice),
                    lowPrice: dec(r.lowPrice),
                    previousClose: dec(r.previousClose),
                    ltp: dec(r.ltp),
                    changePercent: dec(r.changePercent),
                    volume: big(r.volume),
                    turnover: dec(r.turnover),
                    corporateAction: r.corporateAction ?? null,
                });
                break;
            case "LARGE_DEALS":
                records.push({
                    ...base,
                    tradeDate: r.tradeDate ?? tradingDate,
                    filenameDate: tradingDate,
                    securityName: r.security ?? null,
                    clientName: r.clientName ?? null,
                    buySell: r.buySell ?? "UNKNOWN",
                    quantityTraded: big(r.quantityTraded),
                    tradePrice: dec(r.tradePrice),
                    remarks: r.remarks ?? null,
                });
                break;
            default:
                break;
        }
    }
    const model = prisma[tableFor(reportType)];
    for (let i = 0; i < records.length; i += CHUNK) {
        await model.createMany({ data: records.slice(i, i + CHUNK) });
    }
    return records.length;
}
function tableFor(reportType) {
    switch (reportType) {
        case "MOST_ACTIVE_VOLUME":
            return "mostActiveVolume";
        case "MOST_ACTIVE_VALUE":
            return "mostActiveValue";
        case "VOLUME_GAINERS":
            return "volumeGainer";
        case "WEEK52_HIGH":
            return "week52High";
        case "WEEK52_LOW":
            return "week52Low";
        case "TOP_GAINERS":
            return "topGainer";
        case "TOP_LOSERS":
            return "topLoser";
        case "LARGE_DEALS":
            return "largeDeal";
        default:
            throw new Error(`Unknown report type ${reportType}`);
    }
}
// Bhavcopy upserts a single daily OHLC bar per (stock, date). Re-uploading the
// same day's file must not create duplicate bars — it replaces the bar.
// Only persist rows that are normal equity cash-market securities. The NSE
// CM-UDiFF Bhavcopy contains many other series (SME `SM`, futures `N0`-`N9`,
// ETFs, warrants, bonds, etc.); those are NOT normal equity stocks and must not
// be treated as objectives for the swing analyzer.
const EQUITY_SERIES = new Set(["EQ", "BE"]);
// True when the NSE security series represents a normal equity cash-market
// security (the set the swing analyzer treats as objectives).
export function isEquitySeries(series) {
    return EQUITY_SERIES.has((series ?? "EQ").toUpperCase());
}
async function saveBhavcopyRows(tradingDate, uploadId, rows) {
    const equityRows = rows.filter((r) => isEquitySeries(r.series));
    if (equityRows.length === 0)
        return 0;
    const symbols = [...new Set(equityRows.map((r) => r.symbol))];
    const symbolToId = new Map();
    for (const s of symbols) {
        const id = await upsertStock(s, {
            companyName: equityRows.find((r) => r.symbol === s)?.security ?? null,
            series: equityRows.find((r) => r.symbol === s)?.series ?? null,
        });
        symbolToId.set(s, id);
    }
    let count = 0;
    for (const r of equityRows) {
        const stockId = symbolToId.get(r.symbol);
        if (stockId === undefined)
            continue;
        await prisma.dailyPriceBar.upsert({
            where: { stockId_tradingDate: { stockId, tradingDate } },
            update: {
                openPrice: dec(r.openPrice),
                highPrice: dec(r.highPrice),
                lowPrice: dec(r.lowPrice),
                closePrice: dec(r.closePrice),
                lastPrice: dec(r.lastPrice),
                previousClose: dec(r.previousClose),
                vwap: dec(r.vwap),
                tradedQty: big(r.volume),
                turnover: dec(r.turnover),
                trades: r.trades ?? null,
                deliveredQty: big(r.deliveredQty),
                deliverablePct: dec(r.deliverablePct),
                uploadId,
            },
            create: {
                tradingDate,
                stockId,
                symbol: r.symbol,
                openPrice: dec(r.openPrice),
                highPrice: dec(r.highPrice),
                lowPrice: dec(r.lowPrice),
                closePrice: dec(r.closePrice),
                lastPrice: dec(r.lastPrice),
                previousClose: dec(r.previousClose),
                vwap: dec(r.vwap),
                tradedQty: big(r.volume),
                turnover: dec(r.turnover),
                trades: r.trades ?? null,
                deliveredQty: big(r.deliveredQty),
                deliverablePct: dec(r.deliverablePct),
                uploadId,
            },
        });
        count++;
    }
    return count;
}
//# sourceMappingURL=reports.js.map