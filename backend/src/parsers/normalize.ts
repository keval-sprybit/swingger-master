import { toDecimal, toBigInt } from "../utils/decimal.js";
import { parseDate } from "../utils/date.js";

export interface NormalizedRow {
  symbol: string;
  security?: string;
  series?: string;
  isin?: string;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  previousClose?: number;
  closePrice?: number;
  lastPrice?: number;
  vwap?: number;
  trades?: number;
  deliveredQty?: bigint;
  deliverablePct?: number;
  ltp?: number;
  changePercent?: number;
  volume?: bigint;
  turnover?: number;
  corporateAction?: string;
  // volume gainers
  todayVolume?: bigint;
  avgVolume1w?: bigint;
  volumeChange1w?: number;
  avgVolume2w?: bigint;
  volumeChange2w?: number;
  todayLtp?: number;
  todayChangePercent?: number;
  todayTurnover?: number;
  volumeRatio1w?: number;
  volumeRatio2w?: number;
  // week 52
  new52wHigh?: number;
  previousHigh?: number;
  previousHighDate?: Date;
  new52wLow?: number;
  previousLow?: number;
  previousLowDate?: Date;
  // large deals
  tradeDate?: Date;
  clientName?: string;
  buySell?: string;
  quantityTraded?: bigint;
  tradePrice?: number;
  remarks?: string;
  // shared
  raw: Record<string, string>;
}

function num(v: string | undefined): number | undefined {
  const d = toDecimal(v);
  return d === null ? undefined : d.toNumber();
}

function get(row: Record<string, string>, colMap: Record<string, string>, key: string): string | undefined {
  const header = colMap[key];
  if (!header) return undefined;
  const v = row[header];
  return v === undefined ? undefined : v.trim();
}

// Generic OHLC-style row used by MA volume/value, top gainers/losers.
export function normalizeOhlc(
  row: Record<string, string>,
  colMap: Record<string, string>
): NormalizedRow {
  const symbol = (get(row, colMap, "symbol") ?? "").toUpperCase().trim();
  return {
    symbol,
    openPrice: num(get(row, colMap, "open")),
    highPrice: num(get(row, colMap, "high")),
    lowPrice: num(get(row, colMap, "low")),
    previousClose: num(get(row, colMap, "prevClose")),
    ltp: num(get(row, colMap, "ltp")),
    changePercent: num(get(row, colMap, "chng")),
    volume: toBigInt(get(row, colMap, "volume")),
    turnover: num(get(row, colMap, "value")),
    corporateAction: get(row, colMap, "ca"),
    raw: row,
  };
}

export function normalizeVolumeGainer(
  row: Record<string, string>,
  colMap: Record<string, string>
): NormalizedRow {
  const symbol = (get(row, colMap, "symbol") ?? "").toUpperCase().trim();
  const todayVolume = toBigInt(get(row, colMap, "todayVolume")) ?? 0n;
  const avg1w = toBigInt(get(row, colMap, "avgVol1w"));
  const avg2w = toBigInt(get(row, colMap, "avgVol2w"));
  const todayLtp = num(get(row, colMap, "todayLtp"));
  const todayChng = num(get(row, colMap, "todayChng"));
  const turnover = num(get(row, colMap, "todayTurnover"));

  const ratio1w = avg1w && avg1w > 0n ? Number(todayVolume) / Number(avg1w) : null;
  const ratio2w = avg2w && avg2w > 0n ? Number(todayVolume) / Number(avg2w) : null;

  return {
    symbol,
    security: get(row, colMap, "security"),
    todayVolume,
    avgVolume1w: avg1w ?? undefined,
    volumeChange1w: num(get(row, colMap, "volChng1w")),
    avgVolume2w: avg2w ?? undefined,
    volumeChange2w: num(get(row, colMap, "volChng2w")),
    todayLtp,
    todayChangePercent: todayChng,
    todayTurnover: turnover,
    volumeRatio1w: ratio1w ?? undefined,
    volumeRatio2w: ratio2w ?? undefined,
    ltp: todayLtp,
    changePercent: todayChng,
    turnover,
    raw: row,
  };
}

export function normalizeWeek52High(
  row: Record<string, string>,
  colMap: Record<string, string>
): NormalizedRow {
  const symbol = (get(row, colMap, "symbol") ?? "").toUpperCase().trim();
  return {
    symbol,
    series: get(row, colMap, "series"),
    ltp: num(get(row, colMap, "ltp")),
    changePercent: num(get(row, colMap, "chng")),
    new52wHigh: num(get(row, colMap, "new52wHigh")),
    previousHigh: num(get(row, colMap, "prevHigh")),
    previousHighDate: parseDate(get(row, colMap, "prevHighDate")) ?? undefined,
    raw: row,
  };
}

export function normalizeWeek52Low(
  row: Record<string, string>,
  colMap: Record<string, string>
): NormalizedRow {
  const symbol = (get(row, colMap, "symbol") ?? "").toUpperCase().trim();
  return {
    symbol,
    series: get(row, colMap, "series"),
    ltp: num(get(row, colMap, "ltp")),
    changePercent: num(get(row, colMap, "chng")),
    new52wLow: num(get(row, colMap, "new52wLow")),
    previousLow: num(get(row, colMap, "prevLow")),
    previousLowDate: parseDate(get(row, colMap, "prevLowDate")) ?? undefined,
    raw: row,
  };
}
export function normalizeLargeDeal(
  row: Record<string, string>,
  colMap: Record<string, string>,
  filenameDate: Date | null
): NormalizedRow {
  const symbol = (get(row, colMap, "symbol") ?? "").toUpperCase().trim();
  const tradeDate = parseDate(get(row, colMap, "date")) ?? filenameDate ?? undefined;
  const buySellRaw = (get(row, colMap, "buySell") ?? "").toUpperCase();
  const buySell = buySellRaw.includes("B")
    ? "BUY"
    : buySellRaw.includes("S")
    ? "SELL"
    : buySellRaw || "UNKNOWN";
  return {
    symbol,
    security: get(row, colMap, "security"),
    tradeDate,
    clientName: get(row, colMap, "client"),
    buySell,
    quantityTraded: toBigInt(get(row, colMap, "qtyTraded")),
    tradePrice: num(get(row, colMap, "tradePrice")),
    remarks: get(row, colMap, "remarks"),
    raw: row,
  };
}

// NSE Bhavcopy (daily price-volume) row. Only fields present in the file are set;
// anything missing is left undefined (never invented).
export function normalizeBhavcopy(
  row: Record<string, string>,
  colMap: Record<string, string>
): NormalizedRow {
  const symbol = (get(row, colMap, "symbol") ?? "").toUpperCase().trim();
  const volume = toBigInt(get(row, colMap, "volume"));
  const turnover = num(get(row, colMap, "value"));
  const prevClose = num(get(row, colMap, "prevClose"));
  const closePrice = num(get(row, colMap, "close"));
  const changePercent =
    prevClose != null && prevClose > 0 && closePrice != null
      ? ((closePrice - prevClose) / prevClose) * 100
      : num(get(row, colMap, "chng"));
  // CM-UDiFF format includes an ISIN column; preserve it when present.
  const isin = get(row, colMap, "isin");
  return {
    symbol,
    security: get(row, colMap, "security"),
    series: get(row, colMap, "series"),
    isin: isin || undefined,
    openPrice: num(get(row, colMap, "open")),
    highPrice: num(get(row, colMap, "high")),
    lowPrice: num(get(row, colMap, "low")),
    closePrice,
    lastPrice: num(get(row, colMap, "last")),
    previousClose: prevClose,
    ltp: num(get(row, colMap, "ltp")) ?? closePrice,
    changePercent,
    volume,
    turnover,
    vwap: num(get(row, colMap, "vwap")),
    trades: num(get(row, colMap, "trades")),
    deliveredQty: toBigInt(get(row, colMap, "deliveredQty")),
    deliverablePct: num(get(row, colMap, "deliverablePct")),
    raw: row,
  };
}
