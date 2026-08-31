# Analysis Methodology

## Overview

The engine runs in **two distinct modes** over the same trading day's reports:

| Mode | Meaning | Analysis Type |
|---|---|---|
| **TODAY'S INTRADAY ANALYSIS** (`INTRADAY`) | Which stocks to enter/avoid *today*, using current-session levels | `INTRADAY` |
| **NEXT SESSION SWING ANALYSIS** (`SWING`) | Which stocks to watch for *tomorrow*, using today's EOD close + real daily OHLC history | `EOD` |

Both modes use NSE CSV reports (volume activity, gainers, 52-week, large deals) **plus** the standard NSE Bhavcopy daily OHLC history to compute **real technical indicators**, **real breakout levels (with reasons)**, **conservative trade decisions**, **transparent (explainable) scoring**, and **risk-based position sizing**. A backtesting engine validates the rules with strict **no-look-ahead**.

The older legend ("today's high", forced 1:2/1:3 targets) is replaced unless *no* Bhavcopy history exists — in that case the engine degrades gracefully to report-level OHLC and labels the result `INSUFFICIENT_DATA` where appropriate.

## Two-Mode Design Decisions

- **Never share a formula.** Intraday and Swing rank differently on purpose: volume persistence dominates intraday; trend/structure dominate the swing watchlist.
- **Breakouts must be real.** The breakout level is the *nearest resistance above price from actual price history* (recent swing high / 50-day high / previous-day high), each with a reason.
- **Stops must be real.** The stop is the recent swing low / structural support (ATR fallback only when no structure exists).
- **Targets are technical, not invented.** Target 1 = next resistance above entry (else 2× ATR), never force-forced to 1:2. If the resulting R:R is below the minimum, the setup is marked `WEAK BREAKOUT`, not upgraded.
- **Conservatism everywhere.** Intrabar backtest ambiguity resolves to the stop first. "Missed / do-not-chase" and 52-week-lows are never actionable longs.

## Real Technical Indicators (from Bhavcopy)

Computed by `analysis/technical.ts` from stored daily bars:

- **SMA 20 / 50 / 200**
- **RSI-14** (Wilder smoothing)
- **ATR-14** (Wilder smoothing of True Range)
- **Relative volume** (today volume vs 20-day average)
- **Returns** 1/5/10/20-day
- **Structure**: 20/50-day swing highs & lows
- **Support / resistance**: nearest structural support & resistance above/below price (excluding current bar)
- **Breakout level**: nearest resistance above price, within −1%..+15% actionable band
- **Trend classification**: `STRONG_BULLISH / BULLISH / NEUTRAL / BEARISH / STRONG_BEARISH` from DMA alignment with reasons

Insufficient history → `null` indicators + `INSUFFICIENT_DATA`, never invented values.

## Market Condition (`analysis/market.ts`)

`BULLISH / NEUTRAL / BEARISH` derived from index daily bars when index symbols exist in Bhavcopy (NIFTY/BANKNIFTY/…), else a breadth proxy of the day's reports (advancers vs decliners plus 52-week-highs vs lows).

## Scoring Components

### 1. Activity Signals (20 points max)

**Activity Volume (10 pts):** Stock appears in the Most Active Volume report.
**Activity Value (10 pts):** Stock appears in the Most Active Value report.

These are binary signals — present or absent.

### 2. Volume Expansion (20 points max)

Based on volume ratios from the Volume Gainers report:

| 1-Week Ratio | Points |
|---|---|
| < 1.0 | 0 |
| 1.0 – 1.5 | 3 |
| 1.5 – 2.0 | 6 |
| 2.0 – 5.0 | 10 |
| 5.0 – 10.0 | 14 |
| 10.0 – 15.0 | 17 |
| > 15.0 | 20 |

If 2-week ratio is available and higher, it is used instead.

### 3. Momentum (10 points max)

Daily percentage change:

| % Change | Points |
|---|---|
| < 0% | 0 |
| 0 – 1% | 3 |
| 1 – 3% | 5 |
| 3 – 5% | 7 |
| 5 – 7% | 10 (peak) |
| 7 – 10% | 7 (overextended) |
| > 10% | 3 |

### 4. 52-Week Position (20 points max)

**New 52-Week High:**
- Base: +15 points
- If also Most Active Volume: +5 bonus (strong institutional interest)
- **Warning:** Caution about chasing at all-time highs

**New 52-Week Low:**
- Base: -15 points
- If also Top Loser: -5 penalty (weakness confirmation)
- **Warning:** "Stock is making new lows — likely in a downtrend"

### 5. Gainer/Loser Signals (up to +8 / -10)

**Top 20 Gainer:** +8 points
**Top 20 Loser:** -10 points (strongest negative signal)

### 6. Liquidity — Turnover (8 points max)

Based on crude daily turnover buckets:

| Turnover Range | Points |
|---|---|
| < 1 Cr | 0 |
| 1 – 5 Cr | 2 |
| 5 – 20 Cr | 5 |
| > 20 Cr | 8 |

### 7. Large Deals (±5 points max)

Based on net buy/sell quantity:

| Net Quantity | Points |
|---|---|
| Net sell < -50,000 | -5 |
| Net buy > 100,000 | +5 |

### 8. Price Action (5 points max)

**Strong close:** ≥ 70% of day range AND positive % change → +5 points

**Risk penalty:** Close position < 30% of day range (weak close) → -5 points

Close position = `(LTP - dayLow) / (dayHigh - dayLow)`

### 9. Score Normalization

Raw score is clamped to 0–100, then classified:

| Range | Grade |
|---|---|
| ≥ 90 | A+ |
| ≥ 80 | A |
| ≥ 70 | B |
| ≥ 60 | C |
| < 60 | D |

## Trade Setup Logic (Structure-based)

Built by `analysis/structure.ts` — replaced the old percentage-buffer logic.

### Breakout Level (with reason)

Chosen in priority order:

1. **Nearest resistance above price from real history** (`analysis/technical.ts`) — reason is the level's origin (e.g. "50-day high (structural resistance)", "Recent swing high", "Previous day high").
2. Report-level fallbacks (`prevHighPrice`/`highPrice`) when no Bhavcopy history exists.
3. Last resort: +3% estimate, flagged with a warning.

### Entry Zone

```
buffer     = max(0.2%, ATR × 0.3 / price)         [or 0.5% fallback]
entryLow   = breakoutLevel × (1 + buffer)
entryHigh  = breakoutLevel × (1 + 2 × buffer)
```

### Stop Loss (with reason)

- Recent swing low (structure) — "Below recent swing low (structure)"
- Else structural support — "50-day low (structural support)"
- Else report-level `prevLowPrice`/`lowPrice`
- Else (only when no structure exists) `price − 1.5 × ATR`

A structural stop is always preferred over an ATR stop. If stop ≥ entry, the setup is `NO_TRADE`.

### Targets (technical, not forced)

```
target1 = nearest resistance above entry      (reason = its origin)
          else entryLow + 2 × ATR             (reasons "2 ATR above entry")
target2 = target1 + riskPerShare × (2 if ATR available else 1.5)
```

R:R is reported as computed. If it falls below `MIN_RISK_REWARD` the tool says `WEAK BREAKOUT` — it never inflates the target to reach 1:2.

### Position Sizing (risk-based)

```
maximumRisk    = capital × riskPercent / 100
qtyByRisk      = floor(maximumRisk / riskPerShare)
qtyByCapital   = floor(capital / entryLow)
recommendedQty = min(qtyByRisk, qtyByCapital)
capitalUsed    = recommendedQty × entryLow
maximumLoss    = recommendedQty × riskPerShare
```

### Breakout Status & Trade Decision

| Breakout status | Condition | Resulting status |
|---|---|---|
| `WAIT BREAKOUT` | price >3% below breakout | `WAIT_FOR_BREAKOUT` |
| `BREAKOUT APPROACHING` | price within 3% below breakout | `BREAKOUT APPROACHING` |
| `BREAKOUT CONFIRMED` | price above breakout, R:R ≥ min | `ENTRY ACTIVE` (with volume + strong close) **or** `BREAKOUT CONFIRMED` (wait for volume/close) |
| `WEAK BREAKOUT` | price above breakout, R:R < min | `WEAK BREAKOUT` |
| `MISSED — DO NOT CHASE` | price extended >1.2× ATR past breakout | `MISSED` |

Market gating: `BEARISH` market → watch-only unless very strong; `D` score with poor R:R or a 52-week low → `AVOID`.

Only **actionable** statuses enter the trade watchlist: `ENTRY ACTIVE`, `BREAKOUT CONFIRMED`, `BREAKOUT APPROACHING`, `WAIT_FOR_BREAKOUT`. `MISSED`, `AVOID`, `WEAK BREAKOUT`, `NO_TRADE`, `INSUFFICIENT_DATA` never do.

### Confidence Score

```
confidenceRaw = (positiveSignals / totalSignals) × 100
                × (riskReward ≥ minRR ? 1.0 : 0.6)
                × (status multiplier: ENTRY ACTIVE 1.0, WATCH/CONFIRMED 0.85, else 0.7)
```

Capped to 0–100.

## Explainable (Transparent) Scoring

`analysis/scoring.ts` `computeExplainableScore` produces a **0–100 total with a per-component breakdown** and "why" bullets, through two distinct models:

- **INTRADAY**: volume strength · price momentum · signal persistence · technical trend · breakout setup · relative volume · market condition · risk/reward
- **SWING**: trend · price momentum · volume strength · breakout/resistance setup · historical price structure · intraday persistence · market condition · risk/reward · data quality

Downsides are surfaced as `warnings` (chase risk, low-priced stocks, 52-week lows, limited historical data, bearish market). Persisted on `TradeSetup.explainableScore` / `explainableJson`, and ranking uses this score.

## Backtesting (no-look-ahead)

`analysis/backtest.ts`:

- Signals are **stored `TradeSetup`s at their own trading date** (computed only from data available then).
- Outcomes simulate *forward* bars only — never used to decide the signal.
- Exit priority per bar: **stop first** (intrabar both-hit → conservative `LOSS`), then `TARGET1`.
- Time exit caps holding at 20 daily bars.
- Tracks `WIN/LOSS/OPEN`, exit reason, holding days, MFE/MAE %, and portfolio metrics (win rate, profit factor, net P&L %, max drawdown).
- API: `POST /api/backtest`, `GET /api/backtest`, `GET /api/backtest/:id`.

## Duplicate Detection & Snapshot Reuse

Before saving report rows, a SHA-256 checksum of the raw CSV is computed. A snapshot represents the complete market state at a particular time. If a report file is identical to one from a **previous** snapshot (same checksum, older version of the same report type and analysis type):

- No duplicate physical file is stored (the original file is reused).
- No duplicate CSV rows are created.
- The new snapshot **reuses/references** the existing upload (a thin `REUSED` upload row with the new snapshot's version is recorded, pointing back to the original via `metadata.reusedFrom`).

This keeps the new snapshot complete (e.g. 8/8) even when a report hasn't changed. Only a true duplicate *within the same snapshot* is rejected with `DUPLICATE`.

The same concept applies to EOD snapshots (never mixing INTRADAY and EOD reports).

## Trading Day Immutability

Once `DailyMetrics` are computed for a date, they are never overwritten. If a second file for the same date arrives (e.g. intraday update), it is stored as a new report row with `version = INTRA`, and metrics are updated via upsert only for stocks that appear in the new data. Historical stock records remain intact.
