import { prisma } from "../prisma.js";
import { MarketStatus } from "@prisma/client";

interface Draft {
  stockId: number;
  symbol: string;
  openPrice?: number | null;
  highPrice?: number | null;
  lowPrice?: number | null;
  previousClose?: number | null;
  ltp?: number | null;
  changePercent?: number | null;
  volume?: bigint | null;
  turnover?: number | null;
  avgVolume1w?: bigint | null;
  avgVolume2w?: bigint | null;
  volumeRatio1w?: number | null;
  volumeRatio2w?: number | null;
  isMostActiveVolume?: boolean;
  isMostActiveValue?: boolean;
  isVolumeGainer?: boolean;
  is52wHigh?: boolean;
  is52wLow?: boolean;
  isTopGainer?: boolean;
  isTopLoser?: boolean;
  bulkBuyQuantity?: bigint;
  bulkSellQuantity?: bigint;
}

function n(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "object" && typeof v.toNumber === "function") return v.toNumber();
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function b(v: any): bigint | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return v;
  if (typeof v === "object" && typeof v.toNumber === "function") return BigInt(v.toNumber());
  try {
    return BigInt(v);
  } catch {
    return null;
  }
}

export async function ensureTradingDay(tradingDate: Date, status: MarketStatus = MarketStatus.CLOSED) {
  return prisma.tradingDay.upsert({
    where: { tradingDate },
    update: {},
    create: { tradingDate, marketStatus: status },
  });
}

export async function rebuildDailyMetrics(tradingDate: Date): Promise<number> {
  await ensureTradingDay(tradingDate);

  const [maVol, maVal, gainers, w52h, w52l, topG, topL, large] = await Promise.all([
    prisma.mostActiveVolume.findMany({ where: { tradingDate } }),
    prisma.mostActiveValue.findMany({ where: { tradingDate } }),
    prisma.volumeGainer.findMany({ where: { tradingDate } }),
    prisma.week52High.findMany({ where: { tradingDate } }),
    prisma.week52Low.findMany({ where: { tradingDate } }),
    prisma.topGainer.findMany({ where: { tradingDate } }),
    prisma.topLoser.findMany({ where: { tradingDate } }),
    prisma.largeDeal.findMany({ where: { tradingDate } }),
  ]);

  const drafts = new Map<number, Draft>();
  const get = (stockId: number, symbol: string): Draft => {
    let d = drafts.get(stockId);
    if (!d) {
      d = { stockId, symbol, bulkBuyQuantity: 0n, bulkSellQuantity: 0n };
      drafts.set(stockId, d);
    }
    return d;
  };

  for (const r of maVol) {
    const d = get(r.stockId, r.symbol);
    d.openPrice = n(r.openPrice);
    d.highPrice = n(r.highPrice);
    d.lowPrice = n(r.lowPrice);
    d.previousClose = n(r.previousClose);
    d.ltp = n(r.ltp);
    d.changePercent = n(r.changePercent);
    d.volume = b(r.volume);
    d.turnover = n(r.turnover);
    d.isMostActiveVolume = true;
  }
  for (const r of maVal) {
    const d = get(r.stockId, r.symbol);
    if (d.ltp === null || d.ltp === undefined) d.ltp = n(r.ltp);
    if (d.turnover === null || d.turnover === undefined) d.turnover = n(r.turnover);
    if (d.highPrice === null) d.highPrice = n(r.highPrice);
    if (d.lowPrice === null) d.lowPrice = n(r.lowPrice);
    if (d.openPrice === null) d.openPrice = n(r.openPrice);
    if (d.previousClose === null) d.previousClose = n(r.previousClose);
    if (d.changePercent === null) d.changePercent = n(r.changePercent);
    if (d.volume === null) d.volume = b(r.volume);
    d.isMostActiveValue = true;
  }
  for (const r of gainers) {
    const d = get(r.stockId, r.symbol);
    d.avgVolume1w = b(r.avgVolume1w);
    d.avgVolume2w = b(r.avgVolume2w);
    d.volumeRatio1w = n(r.volumeRatio1w);
    d.volumeRatio2w = n(r.volumeRatio2w);
    if (d.ltp === null) d.ltp = n(r.todayLtp);
    if (d.changePercent === null) d.changePercent = n(r.todayChangePercent);
    if (d.turnover === null) d.turnover = n(r.todayTurnover);
    d.isVolumeGainer = true;
  }
  for (const r of w52h) {
    const d = get(r.stockId, r.symbol);
    if (d.ltp === null) d.ltp = n(r.ltp);
    if (d.changePercent === null) d.changePercent = n(r.changePercent);
    if (d.highPrice === null && r.new52wHigh) d.highPrice = n(r.new52wHigh);
    d.is52wHigh = true;
  }
  for (const r of w52l) {
    const d = get(r.stockId, r.symbol);
    if (d.ltp === null) d.ltp = n(r.ltp);
    if (d.changePercent === null) d.changePercent = n(r.changePercent);
    if (d.lowPrice === null && r.new52wLow) d.lowPrice = n(r.new52wLow);
    d.is52wLow = true;
  }
  for (const r of topG) {
    const d = get(r.stockId, r.symbol);
    d.openPrice = d.openPrice ?? n(r.openPrice);
    d.highPrice = d.highPrice ?? n(r.highPrice);
    d.lowPrice = d.lowPrice ?? n(r.lowPrice);
    d.previousClose = d.previousClose ?? n(r.previousClose);
    d.ltp = d.ltp ?? n(r.ltp);
    d.changePercent = d.changePercent ?? n(r.changePercent);
    d.volume = d.volume ?? b(r.volume);
    d.turnover = d.turnover ?? n(r.turnover);
    d.isTopGainer = true;
  }
  for (const r of topL) {
    const d = get(r.stockId, r.symbol);
    d.openPrice = d.openPrice ?? n(r.openPrice);
    d.highPrice = d.highPrice ?? n(r.highPrice);
    d.lowPrice = d.lowPrice ?? n(r.lowPrice);
    d.previousClose = d.previousClose ?? n(r.previousClose);
    d.ltp = d.ltp ?? n(r.ltp);
    d.changePercent = d.changePercent ?? n(r.changePercent);
    d.volume = d.volume ?? b(r.volume);
    d.turnover = d.turnover ?? n(r.turnover);
    d.isTopLoser = true;
  }
  for (const r of large) {
    const d = get(r.stockId, r.symbol);
    const q = b(r.quantityTraded) ?? 0n;
    if (r.buySell === "BUY") d.bulkBuyQuantity = (d.bulkBuyQuantity ?? 0n) + q;
    else if (r.buySell === "SELL") d.bulkSellQuantity = (d.bulkSellQuantity ?? 0n) + q;
  }

  // Compute derived fields and upsert
  let count = 0;
  for (const d of drafts.values()) {
    const high = d.highPrice;
    const low = d.lowPrice;
    const ltp = d.ltp;
    let dayRange: number | null = null;
    let closePosition: number | null = null;
    if (high != null && low != null && high !== low && ltp != null) {
      dayRange = high - low;
      closePosition = ltp !== low ? (ltp - low) / dayRange : 0;
    } else if (high !== null && low !== null && high === low) {
      dayRange = 0;
      closePosition = null; // handle safely (do not divide by zero)
    }
    const sourceCount =
      (d.isMostActiveVolume ? 1 : 0) +
      (d.isMostActiveValue ? 1 : 0) +
      (d.isVolumeGainer ? 1 : 0) +
      (d.is52wHigh ? 1 : 0) +
      (d.is52wLow ? 1 : 0) +
      (d.isTopGainer ? 1 : 0) +
      (d.isTopLoser ? 1 : 0);

    const bulkNet = (d.bulkBuyQuantity ?? 0n) - (d.bulkSellQuantity ?? 0n);

    await prisma.dailyStockMetric.upsert({
      where: { tradingDate_stockId: { tradingDate, stockId: d.stockId } },
      update: {
        openPrice: d.openPrice,
        highPrice: d.highPrice,
        lowPrice: d.lowPrice,
        previousClose: d.previousClose,
        ltp: d.ltp,
        changePercent: d.changePercent,
        volume: d.volume,
        turnover: d.turnover,
        avgVolume1w: d.avgVolume1w,
        avgVolume2w: d.avgVolume2w,
        volumeRatio1w: d.volumeRatio1w,
        volumeRatio2w: d.volumeRatio2w,
        isMostActiveVolume: !!d.isMostActiveVolume,
        isMostActiveValue: !!d.isMostActiveValue,
        isVolumeGainer: !!d.isVolumeGainer,
        is52wHigh: !!d.is52wHigh,
        is52wLow: !!d.is52wLow,
        isTopGainer: !!d.isTopGainer,
        isTopLoser: !!d.isTopLoser,
        bulkBuyQuantity: d.bulkBuyQuantity ?? 0n,
        bulkSellQuantity: d.bulkSellQuantity ?? 0n,
        bulkNetQuantity: bulkNet,
        dayRange,
        closePosition,
        sourceCount,
      },
      create: {
        tradingDate,
        stockId: d.stockId,
        openPrice: d.openPrice,
        highPrice: d.highPrice,
        lowPrice: d.lowPrice,
        previousClose: d.previousClose,
        ltp: d.ltp,
        changePercent: d.changePercent,
        volume: d.volume,
        turnover: d.turnover,
        avgVolume1w: d.avgVolume1w,
        avgVolume2w: d.avgVolume2w,
        volumeRatio1w: d.volumeRatio1w,
        volumeRatio2w: d.volumeRatio2w,
        isMostActiveVolume: !!d.isMostActiveVolume,
        isMostActiveValue: !!d.isMostActiveValue,
        isVolumeGainer: !!d.isVolumeGainer,
        is52wHigh: !!d.is52wHigh,
        is52wLow: !!d.is52wLow,
        isTopGainer: !!d.isTopGainer,
        isTopLoser: !!d.isTopLoser,
        bulkBuyQuantity: d.bulkBuyQuantity ?? 0n,
        bulkSellQuantity: d.bulkSellQuantity ?? 0n,
        bulkNetQuantity: bulkNet,
        dayRange,
        closePosition,
        sourceCount,
      },
    });
    count++;
  }
  return count;
}
