export interface MetricInput {
  stockId: number;
  symbol: string;
  ltp: number | null;
  changePercent: number | null;
  volume: bigint | null;
  turnover: number | null;
  volumeRatio1w: number | null;
  volumeRatio2w: number | null;
  closePosition: number | null;
  dayRange: number | null;
  previousClose: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  openPrice: number | null;
  isMostActiveVolume: boolean;
  isMostActiveValue: boolean;
  isVolumeGainer: boolean;
  is52wHigh: boolean;
  is52wLow: boolean;
  isTopGainer: boolean;
  isTopLoser: boolean;
  bulkBuyQuantity: bigint;
  bulkSellQuantity: bigint;
  bulkNetQuantity: bigint;
  prevHighPrice: number | null;
  prevLowPrice: number | null;
  prevClose: number | null;
  // Upgraded analytical inputs (optional; existing callers are unaffected).
  breakoutLevel?: number | null;
  breakoutReason?: string | null;
  support?: number | null;
  supportReason?: string | null;
  trend?: string | null;
  marketCondition?: "BULLISH" | "NEUTRAL" | "BEARISH" | null;
}

export interface SignalItem {
  key: string;
  label: string;
  points: number;
  source: string;
}

export interface ScoreResult {
  activityVolumeScore: number;
  activityValueScore: number;
  volumeExpansionScore: number;
  momentumScore: number;
  week52Score: number;
  gainerScore: number;
  loserScore: number;
  liquidityScore: number;
  largeDealScore: number;
  priceActionScore: number;
  riskPenalty: number;
  rawScore: number;
  normalizedScore: number;
  classification: "A_PLUS" | "A" | "B" | "C" | "D";
  signals: SignalItem[];
  warnings: string[];
}

export interface SetupSettings {
  capital: number;
  riskPercent: number;
  minRiskReward: number;
}

export interface TradeSetupResult {
  setupType: string | null;
  status: string;
  currentPrice: number | null;
  breakoutLevel: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
  riskPerShare: number | null;
  reward1PerShare: number | null;
  reward2PerShare: number | null;
  riskReward1: number | null;
  riskReward2: number | null;
  capitalAvailable: number;
  riskPercent: number;
  maximumRisk: number;
  recommendedQuantity: number | null;
  capitalUsed: number | null;
  maximumLoss: number | null;
  triggerCondition: string | null;
  invalidationCondition: string | null;
  reason: string | null;
  warnings: string[];
  confidenceScore: number | null;
  // Upgraded analytical fields
  mode?: "INTRADAY" | "SWING";
  breakoutReason?: string | null;
  breakoutStatus?: string | null;
  stopLossReason?: string | null;
  entryReason?: string | null;
  target1Reason?: string | null;
  trend?: string | null;
  trendReasons?: string[];
  marketCondition?: "BULLISH" | "NEUTRAL" | "BEARISH" | null;
  whySelected?: string[];
  insufficientData?: boolean;
  technicalContext?: Record<string, unknown>;
}
