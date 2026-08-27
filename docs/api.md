# API Reference

Base URL: `http://localhost:3001/api`

All responses are JSON. Date parameters use `YYYY-MM-DD` format.

---

## Upload

### POST `/upload`

Upload one or more CSV files. Detects report type, parses, stores, and computes daily metrics.

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
- `NEEDS_REVIEW` — report type could not be detected; manual override required
- `DUPLICATE` — file checksum already exists for this trading date
- `FAILED` — parsing or storage error

---

## Analysis

### POST `/analysis/run`

Run the scoring and trade setup engine for a given trading date.

**Request:**
```json
{
  "tradingDate": "2026-08-27"
}
```

**Response:**
```json
{
  "runId": 1,
  "tradingDate": "2026-08-27",
  "totalStocks": 20,
  "scoredStocks": 20,
  "averageScore": 45.2,
  "status": "COMPLETED"
}
```

### GET `/analysis/dashboard`

Dashboard summary for a trading date.

**Query params:**
- `date` — YYYY-MM-DD (defaults to most recent)

**Response:**
```json
{
  "tradingDate": "2026-08-27",
  "runId": 1,
  "totalStocks": 20,
  "scoredStocks": 15,
  "averageScore": 42.5,
  "candidates": [
    {
      "stockId": 1,
      "symbol": "RELIANCE",
      "name": "Reliance Industries Ltd",
      "normalizedScore": 78,
      "classification": "B",
      "status": "BUY_SETUP",
      "ltp": 2845,
      "changePercent": 2.34,
      "volume": 5000000,
      "turnover": 1400000,
      "entryLow": 2850,
      "entryHigh": 2860,
      "stopLoss": 2790,
      "target1": 2910,
      "target2": 2940,
      "riskReward1": 2.1,
      "recommendedQuantity": 3,
      "confidenceScore": 72
    }
  ],
  "watchlist": [],
  "watchlistStats": {},
  "sectorBreakdown": {},
  "totalVolume": 5000000,
  "totalTurnover": 1400000,
  "avgTurnover": 70000
}
```

### GET `/analysis/candidates`

Sorted candidate list with filtering and pagination.

**Query params:**
- `date` — YYYY-MM-DD
- `sort` — `score` (default), `turnover`, `volume`, `change`
- `order` — `desc` (default), `asc`
- `search` — symbol search
- `page` — page number (default 1)
- `limit` — items per page (default 50)

**Response:**
```json
{
  "date": "2026-08-27",
  "sort": "score",
  "order": "desc",
  "total": 20,
  "page": 1,
  "limit": 50,
  "candidates": [...]
}
```

### GET `/analysis/watchlist`

Watchlist for a given date.

**Query params:**
- `date` — YYYY-MM-DD

**Response:**
```json
{
  "date": "2026-08-27",
  "total": 10,
  "watchlist": [
    {
      "rank": 1,
      "stockId": 1,
      "symbol": "RELIANCE",
      "name": "Reliance Industries Ltd",
      "normalizedScore": 78,
      "status": "BUY_SETUP",
      "ltp": 2845,
      "changePercent": 2.34,
      "volume": 5000000,
      "turnover": 1400000,
      "entryLow": 2850,
      "entryHigh": 2860,
      "stopLoss": 2790,
      "target1": 2910,
      "riskReward1": 2.1,
      "recommendedQuantity": 3,
      "confidenceScore": 72,
      "reason": "Confirmed breakout with strong score"
    }
  ]
}
```

### GET `/analysis/stock/:stockId/history`

Historical data for a stock.

**Query params:**
- `days` — lookback period (default 365)

**Response:**
```json
{
  "stockId": 1,
  "symbol": "RELIANCE",
  "name": "Reliance Industries Ltd",
  "history": [
    {
      "tradingDate": "2026-08-27",
      "ltp": 2845,
      "changePercent": 2.34,
      "open": 2800,
      "high": 2850,
      "low": 2790,
      "volume": 5000000,
      "turnover": 1400000,
      "volumeRatio1w": 5.2,
      "closePosition": 0.8,
      "normalizedScore": 78,
      "classification": "B",
      "status": "BUY_SETUP"
    }
  ]
}
```

### GET `/analysis/history`

List of all trading days with analysis runs.

**Response:**
```json
{
  "days": [
    {
      "tradingDate": "2026-08-27",
      "runId": 1,
      "totalStocks": 20,
      "averageScore": 42.5,
      "completedAt": "2026-08-27T18:30:00Z"
    }
  ]
}
```

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
