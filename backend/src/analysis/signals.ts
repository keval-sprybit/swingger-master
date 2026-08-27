import { MetricInput, ScoreResult, SignalItem } from "./types.js";

const MAX_RAW = 88; // activity10+value10+ve20+mom10+week52(20)+gainer8+loser0+liq8+large5+price5

function volumeExpansionScore(ratio: number | null): number {
  if (ratio === null || ratio < 1) return 0;
  if (ratio < 1.5) return 3;
  if (ratio < 2) return 6;
  if (ratio < 3) return 10;
  if (ratio < 5) return 14;
  if (ratio < 10) return 17;
  return 20;
}

function momentumScore(change: number | null): number {
  if (change === null || change <= 0) return 0;
  if (change < 2) return 3;
  if (change < 5) return 7;
  if (change < 8) return 10;
  if (change < 12) return 7;
  return 3;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function computeSignals(m: MetricInput): ScoreResult {
  const signals: SignalItem[] = [];
  const warnings: string[] = [];

  const activityVolumeScore = m.isMostActiveVolume ? 10 : 0;
  if (m.isMostActiveVolume)
    signals.push({ key: "most_active_volume", label: "Most Active by Volume", points: 10, source: "Most Active by Volume" });

  const activityValueScore = m.isMostActiveValue ? 10 : 0;
  if (m.isMostActiveValue)
    signals.push({ key: "most_active_value", label: "Most Active by Value", points: 10, source: "Most Active by Value" });

  const volumeExpansionScoreVal = volumeExpansionScore(m.volumeRatio1w);
  if (volumeExpansionScoreVal > 0)
    signals.push({
      key: "volume_expansion",
      label: `Volume Expansion (${m.volumeRatio1w ? m.volumeRatio1w.toFixed(2) + "x" : "?"})`,
      points: volumeExpansionScoreVal,
      source: "Volume Gainers",
    });

  const momentumScoreVal = momentumScore(m.changePercent);
  if (momentumScoreVal > 0)
    signals.push({
      key: "momentum",
      label: `Momentum (${m.changePercent ? "+" + m.changePercent.toFixed(2) + "%" : "?"})`,
      points: momentumScoreVal,
      source: "Price Change",
    });

  let week52Score = 0;
  if (m.is52wHigh) {
    week52Score = 15;
    if (m.isMostActiveVolume || m.isMostActiveValue || m.isVolumeGainer) week52Score += 5;
    signals.push({ key: "week52_high", label: "New 52 Week High", points: week52Score, source: "New 52 Week High" });
  } else if (m.is52wLow) {
    week52Score = -15;
    if (m.isTopLoser) week52Score -= 5;
    signals.push({ key: "week52_low", label: "New 52 Week Low", points: week52Score, source: "New 52 Week Low" });
  }

  const gainerScore = m.isTopGainer ? 8 : 0;
  if (m.isTopGainer)
    signals.push({ key: "top_gainer", label: "Top 20 Gainer", points: 8, source: "Top 20 Gainers" });

  const loserScore = m.isTopLoser ? -10 : 0;
  if (m.isTopLoser)
    signals.push({ key: "top_loser", label: "Top 20 Loser", points: -10, source: "Top 20 Losers" });

  // Liquidity heuristic (turnover in ₹ crores). Not a buy signal by itself.
  let liquidityScore = 0;
  const turnover = m.turnover ?? 0;
  if (turnover >= 5) liquidityScore = 8;
  else if (turnover >= 1) liquidityScore = 5;
  else if (turnover >= 0.1) liquidityScore = 3;
  else if (turnover > 0) liquidityScore = 1;
  if (liquidityScore > 0)
    signals.push({ key: "liquidity", label: "Liquidity", points: liquidityScore, source: "Turnover" });

  // Large deals: net buy/sell scaled to [-5, 5]
  let largeDealScore = 0;
  const buy = Number(m.bulkBuyQuantity ?? 0n);
  const sell = Number(m.bulkSellQuantity ?? 0n);
  const total = buy + sell;
  let largeDealMixed = false;
  if (total > 0) {
    largeDealScore = Math.max(-5, Math.min(5, (Number(m.bulkNetQuantity ?? 0n) / total) * 5));
    if (buy > 0 && sell > 0) {
      largeDealMixed = true;
      warnings.push("Both significant bulk BUY and SELL detected - confidence reduced.");
      largeDealScore *= 0.5;
    }
    signals.push({
      key: "large_deal",
      label: `Large Deal (net ${Number(m.bulkNetQuantity ?? 0n) > 0 ? "BUY" : "SELL"})`,
      points: round2(largeDealScore),
      source: "Large Deals / Bulk Deals",
    });
  }

  // Price action
  let priceActionScore = 0;
  let riskPenalty = 0;
  const cp = m.closePosition;
  const chg = m.changePercent ?? 0;
  if (cp !== null && chg > 0) {
    if (cp >= 0.75) {
      priceActionScore = 5;
      signals.push({ key: "price_action", label: "Strong Close (near high)", points: 5, source: "Price Action" });
    } else if (cp < 0.4) {
      riskPenalty += 5;
      warnings.push("Weak price action: closed near the day low despite positive change.");
    }
  }

  if (m.is52wLow) warnings.push("New 52-week low - avoid treating as a buy.");
  if (chg > 12) warnings.push("High one-day movement - possible volatility/chase risk.");

  const rawScore =
    activityVolumeScore +
    activityValueScore +
    volumeExpansionScoreVal +
    momentumScoreVal +
    week52Score +
    gainerScore +
    loserScore +
    liquidityScore +
    largeDealScore +
    priceActionScore -
    riskPenalty;

  const normalizedScore = Math.max(0, Math.min(100, Math.round((Math.max(0, rawScore) / MAX_RAW) * 1000) / 10));

  let classification: ScoreResult["classification"] = "D";
  if (normalizedScore >= 90) classification = "A_PLUS";
  else if (normalizedScore >= 80) classification = "A";
  else if (normalizedScore >= 70) classification = "B";
  else if (normalizedScore >= 60) classification = "C";

  return {
    activityVolumeScore,
    activityValueScore,
    volumeExpansionScore: volumeExpansionScoreVal,
    momentumScore: momentumScoreVal,
    week52Score,
    gainerScore,
    loserScore,
    liquidityScore,
    largeDealScore: round2(largeDealScore),
    priceActionScore,
    riskPenalty,
    rawScore: round2(rawScore),
    normalizedScore,
    classification,
    signals,
    warnings,
  };
}
