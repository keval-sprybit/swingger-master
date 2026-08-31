# API Reference

Base URL: `http://localhost:3000/api`

All responses are JSON. Date parameters use `YYYY-MM-DD` format.

---

## Upload

### POST `/uploads`

Upload one or more CSV files. Detects report type, parses, stores, and computes daily metrics. Standard NSE **Bhavcopy** files (`cm*bhav.csv`) are detected as `BHAVCOPY` and stored as `DailyPriceBar` history (deduplicated per stock/date).

**Request:** `multipart/form-data`
- `files` — one or more `.csv` files (max 25MB each)
- `reportType` — optional, force report type (overrides auto-detection)
- `tradingDate` — optional, override date (YYYY-MM-DD)

**Response:**
```json
{
  "results": [
    {
      "filename": "MA-Equities-CM-volume-27-Aug-2026.csv",
      "reportType": "MOST_ACTIVE_VOLUME",
      "needsReview": false,
      "tradingDate": "2026-08-27",
      "status": "PROCESSED",
      "validRows": 20,
      "invalidRows": 0,
      "totalRows": 20,
      "stocksProcessed": 20,
      "warnings": []
    }
  ]
}
```

**Status values:**
- `PROCESSED` — successfully parsed and stored
- `REUSED` — file checksum already exists from a prior snapshot; the new snapshot references the existing upload (no new file/rows stored), keeping the snapshot complete
- `NEEDS_REVIEW` — report type could not be detected; manual override required
- `DUPLICATE` — the identical file already belongs to the *same* snapshot (true duplicate within the batch)
- `FAILED` — parsing or storage error

---

## Analysis

### POST `/analysis/run`

Run the two-mode scoring and trade-setup engine for a given trading date.

**Request:**
```json
{
  "tradingDate": "2026-08-27",
  "analysisType": "EOD",
  "mode": "SWING"
}
```

- `analysisType`: `EOD` (default, → SWING / next-session), `INTRADAY` (→ TODAY'S INTRADAY ANALYSIS), `PRE_MARKET` (→ SWING).
- `mode`: optional explicit override `INTRADAY` | `SWING`.

**Response:**
```json
{
  "runId": 1,
  "tradingDate": "2026-08-27",
  "nextTradingDate": "2026-08-28",
  "analysisType": "EOD",
  "mode": "SWING",
  "status": "COMPLETED",
  "stocksAnalyzed": 20,
  "filesReceived": 8,
  "filesExpected": 8,
  "watchlistSize": 5,
  "marketCondition": "BULLISH"
}
```

### GET `/dashboard`

Dashboard summary for a trading date.

**Query params:**
- `date` — YYYY-MM-DD (defaults to most recent)
- `mode` — `INTRADAY` | `SWING` (defaults to INTRADAY while market open, else SWING)
- `snapshot` — upload-version snapshot from the History page

**Response:**
```json
{
  "tradingDate": "2026-08-27",
  "mode": "SWING",
  "marketCondition": "BULLISH",
  "analysisStatus": "COMPLETED",
  "topCandidates": [
    {
      "rank": 1,
      "symbol": "RELIANCE",
      "score": 78,
      "explainableScore": 82.4,
      "classification": "B",
      "ltp": 2845,
      "status": "ENTRY ACTIVE",
      "breakoutLevel": 2850,
      "breakoutStatus": "BREAKOUT CONFIRMED",
      "riskReward1": 2.3,
      "trend": "BULLISH",
      "whySelected": ["Breakout confirmed", "Good risk/reward (1:2.3)"]
    }
  ],
  "watchlist": [...],
  "nextTradingDate": "2026-08-28"
}
```

### GET `/candidates`

Sorted candidate list (ranked by explainable score).

**Query params:**
- `date` — YYYY-MM-DD
- `mode` — `INTRADAY` | `SWING` (default `SWING`)
- `limit` — items per page (default 100)

### GET `/candidates/:symbol`

Full detail for one stock: metric, legacy score, structure-based setup (breakout level + reason, stop + reason, targets + reason, position sizing, trend, why-selected), Bhavcopy `priceBars` history.

**Query params:**
- `date`, `mode`

### GET `/candidates/:symbol/chart`

Chart data for the candlestick / volume / MA price chart on the Candidate Detail page. This is the SOURCE OF TRUTH for what the chart draws — bars come from real stored NSE Bhavcopy (`DailyPriceBar`) and the moving-average series are computed from those same bars (never fabricated). The analysis levels (breakout, entry, stop, targets, support, resistance) come from the stored `TradeSetup` so the chart always agrees with the analysis page.

**Query params:**
- `mode` — `INTRADAY` | `SWING` (default `SWING`). In `INTRADAY` mode the app returns the daily EOD bars clearly labelled `EOD` with `intradayAvailable: false`, because the application stores daily bars, not candle-by-candle intraday data.
- `range` — `3M` | `6M` | `MAX` (default `6M`).

**Response shape:**
```jsonc
{
  "symbol": "RELIANCE",
  "tradingDate": "2026-08-27",
  "dataType": "EOD",
  "dataTime": null,
  "bars": [ { "tradingDate": "...", "open": 1284.9, "high": 1291.8, "low": 1280, "close": 1287, "volume": 6830228, "sma20": null, "sma50": null, "sma200": null } ],
  "availableDays": 1,
  "indicators": { "sma20": null, "sma50": null, "sma200": null, "rsi14": null, "atr14": null, "relVolume": null, "trend": "NEUTRAL", "support": null, "resistance": null },
  "levels": { "currentPrice": 3055, "breakout": 3060, "entryLow": 3075.3, "entryHigh": 3090.6, "stopLoss": 1287, "target1": 3259.818, "target2": 5942.268, "riskReward1": 0.1 },
  "status": "AVOID",
  "breakoutStatus": null,
  "insufficientData": false,
  "intradayAvailable": false
}
```
`null` indicators mean **INSUFFICIENT DATA** (e.g. fewer than 20/50/200 bars) — they are never filled with invented values.



Watchlist for a given date (actionable, conservative statuses only).

**Query params:**
- `date`, `mode`

### GET `/history`

List of trading days with snapshots; each snapshot exposes `mode` and `marketCondition`.

### GET `/stocks/:symbol/history`

Per-stock score/metric history.

---

## Backtesting

### POST `/backtest`

Simulate stored setups across a date range with strict no-look-ahead (only `ENTRY ACTIVE`/`BREAKOUT CONFIRMED` setups become trades; exit always resolves intrabar stop-first).

**Request:**
```json
{
  "from": "2026-08-01",
  "to": "2026-08-27",
  "mode": "SWING",
  "label": "Aug swing"
}
```

**Response:**
```json
{
  "runId": 3,
  "mode": "SWING",
  "metrics": { "totalTrades": 12, "wins": 7, "losses": 4, "open": 1, "winRate": 63.6, "profitFactor": 1.8, "netPnlPct": 4.2, "maxDrawdownPct": 1.9, "avgHoldingDays": 6.1 },
  "trades": [...]
}
```

### GET `/backtest`

List recent backtest runs.

### GET `/backtest/:id`

Full run including trades (WIN/LOSS/OPEN, exit reason, MFE/MAE %, P&L %).

---

## Paper Trading

### GET `/paper-trades`

List paper trades.

**Query params:**
- `stockId` — filter by stock
- `page`, `limit`

**Response:**
```json
{
  "trades": [...],
  "total": 5,
  "stats": {
    "totalTrades": 5,
    "winTrades": 3,
    "lossTrades": 2,
    "winRate": 60.0,
    "totalPnl": 1500.50,
    "avgPnl": 300.10,
    "maxDrawdown": 200.00,
    "profitFactor": 2.1,
    "avgHoldingDays": 5.2
  }
}
```

### POST `/paper-trades`

Record a paper trade.

**Request:**
```json
{
  "stockId": 1,
  "analysisRunId": 1,
  "entryDate": "2026-08-27",
  "exitDate": "2026-09-02",
  "entryPrice": 2850,
  "exitPrice": 2920,
  "quantity": 3,
  "direction": "LONG",
  "fees": 50,
  "notes": "Hit target 1"
}
```

### DELETE `/paper-trades/:id`

Delete a paper trade.

---

## Settings

### GET `/settings`

Get current settings.

**Response:**
```json
{
  "capital": 20000,
  "riskPercent": 1,
  "minRiskReward": 2,
  "watchlistSize": 10
}
```

### PUT `/settings`

Update settings.

**Request:**
```json
{
  "capital": 50000,
  "riskPercent": 2,
  "minRiskReward": 3,
  "watchlistSize": 15
}
```

---

## Error Responses

All errors follow the format:
```json
{
  "error": "Error message",
  "details": {}
}
```

**Common error codes:**
- `400` — Validation error (missing required fields, invalid types)
- `404` — Resource not found (stock, run, trade)
- `500` — Internal server error
