// Technical indicator calculations.
//
// All indicators are computed ONLY from real, stored daily price bars (NSE
// Bhavcopy), sorted oldest -> newest. If there is not enough data for a given
// indicator, it returns null (INSUFFICIENT DATA) — never an invented value.
//
// Formulas (standard):
//   SMA(n)  = arithmetic mean of last n closes
//   RSI(14) = 100 - 100/(1+RS), RS = avgGain/avgLoss (Wilder)
//   ATR(14) = Wilder-smoothed mean of True Range
//   Relative volume = today volume / 20-day average volume

export interface PriceBar {
  tradingDate: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceStructure {
  swingHigh: number; // highest high of the window
  swingHighDaysAgo: number;
  swingLow: number;
  swingLowDaysAgo: number;
}

export interface SupportResistance {
  support: { level: number; reason: string } | null;
  resistance: { level: number; reason: string } | null;
}

export type TrendClass =
  | "STRONG_BULLISH"
  | "BULLISH"
  | "NEUTRAL"
  | "BEARISH"
  | "STRONG_BEARISH";

export interface TechnicalIndicators {
  available: boolean;
  availableDays: number;
  // SMAs
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  // RSI / ATR
  rsi14: number | null;
  atr14: number | null;
  // Volume
  relVolume: number | null;
  avgVolume20: number | null;
  // Returns
  return1d: number | null;
  return5d: number | null;
  return10d: number | null;
  return20d: number | null;
  // Highs / lows
  high20: number | null;
  low20: number | null;
  high50: number | null;
  low50: number | null;
  // Structure
  structure: { recent: PriceStructure | null; last20: PriceStructure | null; last50: PriceStructure | null };
  supportResistance: SupportResistance;
  breakoutLevel: number | null;
  breakoutReason: string | null;
  trend: TrendClass | null;
  trendReasons: string[];
}

const NEEDED_SMA20 = 20;
const NEEDED_SMA50 = 50;
const NEEDED_SMA200 = 200;
const NEEDED_RSI = 15; // 14 + 1 (Wilder needs one extra bar)
const NEEDED_ATR = 15;
const NEEDED_RETURN = 21;

function sma(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  let sum = 0;
  for (let i = closes.length - period; i < closes.length; i++) sum += closes[i];
  return sum / period;
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  gain /= period;
  loss /= period;
  for (let i = closes.length - period - 1; i >= 1; i--) {
    const diff = closes[i] - closes[i - 1];
    const g = diff >= 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
  }
  if (loss === 0) return 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}

function atr(bars: PriceBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const trueRanges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prevClose = bars[i - 1].close;
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - prevClose),
      Math.abs(bars[i].low - prevClose)
    );
    trueRanges.push(tr);
  }
  // Wilder smoothing
  let atrVal = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atrVal = (atrVal * (period - 1) + trueRanges[i]) / period;
  }
  return atrVal;
}

function returnPct(from: number | null, to: number): number | null {
  if (from === null || from <= 0) return null;
  return ((to - from) / from) * 100;
}

function maxHigh(bars: PriceBar[]): { high: number; daysAgo: number } | null {
  if (bars.length === 0) return null;
  let best = bars[0];
  for (const b of bars) if (b.high > best.high) best = b;
  return { high: best.high, daysAgo: bars.length - 1 - bars.lastIndexOf(best) };
}

function minLow(bars: PriceBar[]): { low: number; daysAgo: number } | null {
  if (bars.length === 0) return null;
  let best = bars[0];
  for (const b of bars) if (b.low < best.low) best = b;
  return { low: best.low, daysAgo: bars.length - 1 - bars.lastIndexOf(best) };
}

export function classifyTrend(
  closes: number[],
  sma20: number | null,
  sma50: number | null,
  sma200: number | null
): { trend: TrendClass | null; reasons: string[] } {
  const reasons: string[] = [];
  if (closes.length < 1) return { trend: null, reasons };

  const price = closes[closes.length - 1];
  let score = 0;

  if (sma20 != null) {
    if (price > sma20) {
      score += 1;
      reasons.push("Price above 20 DMA");
    } else {
      score -= 1;
      reasons.push("Price below 20 DMA");
    }
  }
  if (sma50 != null) {
    if (price > sma50) {
      score += 1;
      reasons.push("Price above 50 DMA");
    } else {
      score -= 1;
      reasons.push("Price below 50 DMA");
    }
  }
  if (sma20 != null && sma50 != null) {
    if (sma20 > sma50) {
      score += 1;
      reasons.push("20 DMA above 50 DMA (bullish cross)");
    } else {
      score -= 1;
      reasons.push("20 DMA below 50 DMA (bearish cross)");
    }
  }
  if (sma200 != null && price > sma200) {
    score += 1;
    reasons.push("Price above 200 DMA");
  } else if (sma200 != null) {
    score -= 1;
    reasons.push("Price below 200 DMA");
  }

  let trend: TrendClass;
  if (score >= 2) trend = "BULLISH";
  else if (score <= -2) trend = "BEARISH";
  else trend = "NEUTRAL";
  if (score >= 3) trend = "STRONG_BULLISH";
  else if (score <= -3) trend = "STRONG_BEARISH";

  return { trend, reasons };
}

export function computeIndicators(bars: PriceBar[]): TechnicalIndicators {
  const closes = bars.map((b) => b.close);
  const availableDays = bars.length;

  const sma20 = sma(closes, NEEDED_SMA20);
  const sma50 = sma(closes, NEEDED_SMA50);
  const sma200 = sma(closes, NEEDED_SMA200);
  const rsi14 = rsi(closes, 14);
  const atr14 = atr(bars, 14);

  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const avgVolume20Arr = bars.slice(-20);
  const avgVolume20 =
    avgVolume20Arr.length >= 20
      ? avgVolume20Arr.reduce((a, b) => a + b.volume, 0) / avgVolume20Arr.length
      : null;
  const relVolume = avgVolume20 && avgVolume20 > 0 ? last.volume / avgVolume20 : null;

  const return1d = prev ? returnPct(prev.close, last.close) : null;
  const return5d = bars.length >= 6 ? returnPct(bars[bars.length - 6].close, last.close) : null;
  const return10d = bars.length >= 11 ? returnPct(bars[bars.length - 11].close, last.close) : null;
  const return20d = bars.length >= NEEDED_RETURN ? returnPct(bars[bars.length - 21].close, last.close) : null;

  const last20 = bars.slice(-20);
  const last50 = bars.slice(-50);
  const recent = bars.slice(-5);

  const struct20 = last20.length >= 20 ? { high: maxHigh(last20), low: minLow(last20) } : { high: null, low: null };
  const struct50 = last50.length >= 50 ? { high: maxHigh(last50), low: minLow(last50) } : { high: null, low: null };

  const high20 = struct20.high?.high ?? null;
  const low20 = struct20.low?.low ?? null;
  const high50 = struct50.high?.high ?? null;
  const low50 = struct50.low?.low ?? null;

  // Support / resistance from real nearby structure (excluding the current bar
  // to avoid self-referential levels).
  const prior = bars.slice(0, -1);
  const prior20 = prior.slice(-20);
  const rMax = maxHigh(prior20);
  const sMin = minLow(prior20);
  const rHigh = high50 ?? rMax?.high ?? null;
  const sLow = low50 ?? sMin?.low ?? null;
  const support =
    sLow != null
      ? { level: sLow, reason: low50 != null ? "50-day low (structural support)" : "20-day low (structural support)" }
      : null;
  const resistance =
    rHigh != null
      ? { level: rHigh, reason: high50 != null ? "50-day high (structural resistance)" : "20-day high (structural resistance)" }
      : null;

  // Breakout level = nearest resistance above current price, with a reason.
  let breakoutLevel: number | null = null;
  let breakoutReason: string | null = null;
  const candidates: { level: number; reason: string }[] = [];
  if (resistance?.level != null && resistance.level > last.close) {
    candidates.push({ level: resistance.level, reason: resistance.reason });
  }
  const priorHigh5 = maxHigh(prior.slice(-5));
  if (priorHigh5 && priorHigh5.high > last.close) {
    candidates.push({ level: priorHigh5.high, reason: "Recent swing high" });
  } else if (priorHigh5 && priorHigh5.high <= last.close && priorHigh5.daysAgo > 0) {
    candidates.push({ level: priorHigh5.high, reason: "Recently broken swing high (watch retest)" });
  }
  if (prev && prev.high > last.close) {
    candidates.push({ level: prev.high, reason: "Previous day high" });
  }
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.level - b.level);
    const nearest = candidates[0];
    const distPct = last.close > 0 ? ((nearest.level - last.close) / last.close) * 100 : Infinity;
    // Only treat a level as a meaningful "breakout" if it is above price but
    // not absurdly far (within 15%) — beyond that it's not actionable breakout.
    if (distPct >= -1 && distPct <= 15) {
      breakoutLevel = nearest.level;
      breakoutReason = nearest.reason;
    }
  }

  const { trend, reasons } = classifyTrend(closes, sma20, sma50, sma200);

  const structure = {
    recent:
      recent.length >= 5
        ? {
            swingHigh: maxHigh(recent)!.high,
            swingHighDaysAgo: maxHigh(recent)!.daysAgo,
            swingLow: minLow(recent)!.low,
            swingLowDaysAgo: minLow(recent)!.daysAgo,
          }
        : null,
    last20:
      struct20.high && struct20.low
        ? {
            swingHigh: struct20.high.high,
            swingHighDaysAgo: struct20.high.daysAgo,
            swingLow: struct20.low.low,
            swingLowDaysAgo: struct20.low.daysAgo,
          }
        : null,
    last50:
      struct50.high && struct50.low
        ? {
            swingHigh: struct50.high.high,
            swingHighDaysAgo: struct50.high.daysAgo,
            swingLow: struct50.low.low,
            swingLowDaysAgo: struct50.low.daysAgo,
          }
        : null,
  };

  return {
    available: availableDays >= NEEDED_SMA20 || rsi14 != null || atr14 != null,
    availableDays,
    sma20,
    sma50,
    sma200,
    rsi14,
    atr14,
    relVolume,
    avgVolume20,
    return1d,
    return5d,
    return10d,
    return20d,
    high20,
    low20,
    high50,
    low50,
    structure,
    supportResistance: { support, resistance },
    breakoutLevel,
    breakoutReason,
    trend,
    trendReasons: reasons,
  };
}
