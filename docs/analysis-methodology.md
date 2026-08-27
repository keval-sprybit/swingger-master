# Analysis Methodology

## Overview

The analysis engine scores each stock across multiple weighted factors on a 0–100 scale, then generates trade setups for the top candidates with specific entry, stop loss, target, and position sizing rules.

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

## Trade Setup Logic

### Breakout Level

`breakoutLevel = prevDayHigh ?? todayHigh`

The highest recent resistance level used as the trigger for entry.

### Entry Zone

```
entryLow  = breakoutLevel × (1 + buffer)
entryHigh = breakoutLevel × (1 + 2 × buffer)
```

Buffer is based on half the intraday range ratio, clamped to 0.3%–3%:
```
buffer = clamp(dayRange / price × 0.5, 0.003, 0.03)
```

### Stop Loss

```
stopLoss = support × (1 - buffer)
support  = prevDayLow ?? todayLow
```

### Targets

```
riskPerShare    = entryLow - stopLoss
target1         = entryLow + 2 × riskPerShare    (2:1 R:R)
target2         = entryLow + 3 × riskPerShare    (3:1 R:R)
```

### Position Sizing

```
maximumRisk     = capital × riskPercent / 100
qtyByRisk       = floor(maximumRisk / riskPerShare)
qtyByCapital    = floor(capital / entryLow)
recommendedQty  = min(qtyByRisk, qtyByCapital)
capitalUsed     = recommendedQty × entryLow
maximumLoss     = recommendedQty × riskPerShare
```

### Status Determination

| Status | Condition |
|---|---|
| `AVOID` | 52-week low; OR stop ≥ entry; OR top loser with score < 60 |
| `CHASE_RISK` | Price > 1.5% above breakout — too extended to enter |
| `WAIT_FOR_BREAKOUT` | Price below breakout level |
| `BUY_SETUP` | Breakout confirmed, score ≥ 70, R:R ≥ 2 |
| `WATCH` | Breakout confirmed but score < 70 or R:R insufficient |
| `INSUFFICIENT_DATA` | Missing ltp, breakout level, or stop level |

### Confidence Score

```
confidenceRaw = (positiveSignals / totalSignals) × 100
                × (riskReward ≥ minRR ? 1.0 : 0.6)
```

Capped to 0–100.

## Duplicate Detection

Before saving report rows, a SHA-256 checksum of the raw CSV is computed. If a file with the same checksum and same trading date already exists, the upload is rejected with a `DUPLICATE` status. This prevents re-analyzing the same data.

## Trading Day Immutability

Once `DailyMetrics` are computed for a date, they are never overwritten. If a second file for the same date arrives (e.g. intraday update), it is stored as a new report row with `version = INTRA`, and metrics are updated via upsert only for stocks that appear in the new data. Historical stock records remain intact.
