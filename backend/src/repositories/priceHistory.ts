import { prisma } from "../prisma.js";
import { PriceBar } from "../analysis/technical.js";
import { Decimal } from "@prisma/client/runtime/library.js";

export interface Coverage {
  available: boolean;
  availableDays: number;
  missingDates: number;
  fromDate: string | null;
  toDate: string | null;
}

// Load a stock's daily price bars oldest->newest from Bhavcopy history.
function toNumber(v: Decimal | number | bigint | null | undefined, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  return v.toNumber();
}

export async function loadPriceBars(stockId: number, limit = 260): Promise<PriceBar[]> {
  const bars = await prisma.dailyPriceBar.findMany({
    where: { stockId },
    orderBy: { tradingDate: "asc" },
    take: limit,
  });
  return bars.map((b) => {
    const close = toNumber(b.closePrice, toNumber(b.lastPrice, toNumber(b.openPrice, 0)));
    const open = toNumber(b.openPrice, close);
    const high = toNumber(b.highPrice, close);
    const low = toNumber(b.lowPrice, close);
    return {
      tradingDate: b.tradingDate,
      open,
      high,
      low,
      close,
      volume: toNumber(b.tradedQty, 0),
    };
  });
}

// Load bars for many stock IDs in one query. Returns Map<stockId, bars>.
export async function loadPriceBarsForStockIds(stockIds: number[], limit = 260): Promise<Map<number, PriceBar[]>> {
  const bars = await prisma.dailyPriceBar.findMany({
    where: { stockId: { in: stockIds } },
    orderBy: { tradingDate: "asc" },
    take: limit * Math.max(1, stockIds.length),
  });
  const byId = new Map<number, PriceBar[]>();
  for (const b of bars) {
    const close = toNumber(b.closePrice, toNumber(b.lastPrice, toNumber(b.openPrice, 0)));
    const open = toNumber(b.openPrice, close);
    const high = toNumber(b.highPrice, close);
    const low = toNumber(b.lowPrice, close);
    const arr = byId.get(b.stockId) ?? [];
    arr.push({
      tradingDate: b.tradingDate,
      open,
      high,
      low,
      close,
      volume: toNumber(b.tradedQty, 0),
    });
    byId.set(b.stockId, arr);
  }
  return byId;
}

export async function loadPriceBarsForSymbol(symbol: string, limit = 260): Promise<PriceBar[]> {
  const stock = await prisma.stock.findUnique({ where: { symbol } });
  if (!stock) return [];
  return loadPriceBars(stock.id, limit);
}

// Load bars for many stocks in one query (used by backtest). Returns Map<symbol, bars>.
export async function loadPriceBarsForSymbols(symbols: string[], limit = 300): Promise<Map<string, PriceBar[]>> {
  const stocks = await prisma.stock.findMany({ where: { symbol: { in: symbols } } });
  const map = new Map(stocks.map((s) => [s.symbol, s.id]));
  const ids = [...map.values()];
  const bars = await prisma.dailyPriceBar.findMany({
    where: { stockId: { in: ids } },
    orderBy: { tradingDate: "asc" },
    take: limit,
  });
  const bySymbol = new Map<string, PriceBar[]>();
  const idToSym = new Map([...map.entries()].map(([sym, id]) => [id, sym]));
  for (const b of bars) {
    const sym = idToSym.get(b.stockId);
    if (!sym) continue;
    const arr = bySymbol.get(sym) ?? [];
    const close = toNumber(b.closePrice, toNumber(b.lastPrice, toNumber(b.openPrice, 0)));
    const open = toNumber(b.openPrice, close);
    const high = toNumber(b.highPrice, close);
    const low = toNumber(b.lowPrice, close);
    arr.push({
      tradingDate: b.tradingDate,
      open,
      high,
      low,
      close,
      volume: toNumber(b.tradedQty, 0),
    });
    bySymbol.set(sym, arr);
  }
  return bySymbol;
}

// Coverage of the bhavcopy history for a stock.
export async function coverageForStock(stockId: number): Promise<Coverage> {
  const bars = await prisma.dailyPriceBar.findMany({
    where: { stockId },
    orderBy: { tradingDate: "asc" },
    select: { tradingDate: true },
  });
  if (bars.length === 0) return { available: false, availableDays: 0, missingDates: 0, fromDate: null, toDate: null };
  const dates = bars.map((b) => b.tradingDate);
  const from = dates[0];
  const to = dates[dates.length - 1];
  // Trading-day estimate: count calendar weekdays in the range minus observed bars.
  let weekdays = 0;
  const cur = new Date(from);
  while (cur <= to) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) weekdays++;
    cur.setDate(cur.getDate() + 1);
  }
  const missingDates = Math.max(0, weekdays - bars.length);
  return {
    available: true,
    availableDays: bars.length,
    missingDates,
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
}
