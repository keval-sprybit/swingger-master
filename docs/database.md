# Database Schema

MySQL 8+ managed via Prisma ORM. All tables created by `prisma migrate dev`.

## Entity Relationship Diagram (Text)

```
Stock ──┬── DailyMetric (1:N, unique per date)
        ├── ReportRow (1:N, per report per date)
        ├── AnalysisResult (1:N, per analysis run)
        ├── SetupCandidate (1:N, per analysis run)
        ├── WatchlistEntry (1:N, per analysis run)
        ├── PaperTrade (1:N)
        └── TradeSignal (1:N, per analysis run)

Upload ──── ReportRow (1:N)

AnalysisRun ──┬── AnalysisResult (1:N)
              ├── SetupCandidate (1:N)
              ├── WatchlistEntry (1:N)
              └── TradeSignal (1:N)

Settings (singleton, 1 row)
```

## Core Models

### Stock

| Column | Type | Notes |
|---|---|---|
| id | INT (auto) | Primary key |
| symbol | VARCHAR(50) | Unique |
| name | VARCHAR(255) | Nullable |
| sector | VARCHAR(100) | Nullable |
| industry | VARCHAR(100) | Nullable |
| series | VARCHAR(20) | Nullable |
| isin | VARCHAR(20) | Nullable |
| createdAt | DATETIME | Auto |
| updatedAt | DATETIME | Auto |

**Unique index:** `(symbol)`

### DailyMetric

| Column | Type | Notes |
|---|---|---|
| id | INT (auto) | Primary key |
| stockId | INT | FK → Stock |
| tradingDate | DATE | |
| open, high, low, ltp, prevClose | DECIMAL(12,2) | Nullable |
| changePercent | DECIMAL(8,4) | Nullable |
| volume | BIGINT | Nullable |
| turnover | DECIMAL(14,2) | Nullable |
| volumeRatio1w, volumeRatio2w | DECIMAL(8,2) | Nullable |
| closePosition | DECIMAL(4,2) | 0.0–1.0 |
| dayRange | DECIMAL(8,2) | |
| highPrice, lowPrice | DECIMAL(12,2) | Previous day values (nullable) |
| prevHighPrice, prevLowPrice, prevClose | DECIMAL(12,2) | Nullable |
| isMostActiveVolume/Value, isVolumeGainer | BOOLEAN | |
| is52wHigh, is52wLow, isTopGainer, isTopLoser | BOOLEAN | |
| bulkBuyQuantity, bulkSellQuantity, bulkNetQuantity | BIGINT | |
| createdAt, updatedAt | DATETIME | |

**Unique index:** `(stockId, tradingDate)`

### ReportRow

| Column | Type | Notes |
|---|---|---|
| id | INT (auto) | Primary key |
| stockId | INT | FK → Stock |
| uploadId | INT | FK → Upload |
| tradingDate | DATE | |
| reportType | ENUM | 8 values + NEEDS_REVIEW |
| version | ENUM | INTRA or empty |
| open, high, low, ltp, prevClose | DECIMAL(12,2) | Nullable |
| changePercent | DECIMAL(8,4) | Nullable |
| volume | BIGINT | Nullable |
| turnover | DECIMAL(14,2) | Nullable |
| additionalData | JSON | Flexible storage for report-specific fields |
| rowHash | VARCHAR(64) | SHA-256 for dedup |
| createdAt | DATETIME | |

### Upload

| Column | Type | Notes |
|---|---|---|
| id | INT (auto) | Primary key |
| filename | VARCHAR(255) | Original filename |
| storedPath | VARCHAR(500) | Relative path in uploads/ |
| reportType | ENUM | Detected or assigned type |
| tradingDate | DATE | Detected |
| checksum | VARCHAR(64) | SHA-256 of file content |
| status | ENUM | PROCESSED / FAILED / NEEDS_REVIEW |
| totalRows | INT | |
| validRows | INT | |
| invalidRows | INT | |
| errorMessage | TEXT | Nullable |
| createdAt | DATETIME | |

### AnalysisRun

| Column | Type | Notes |
|---|---|---|
| id | INT (auto) | Primary key |
| tradingDate | DATE | Target date |
| startedAt, completedAt | DATETIME | |
| totalStocks | INT | |
| scoredStocks | INT | |
| averageScore | DECIMAL(6,2) | |
| status | ENUM | RUNNING / COMPLETED / FAILED |
| errorMessage | TEXT | Nullable |

### AnalysisResult

Scored output per stock per run.

| Column | Type | Notes |
|---|---|---|
| analysisRunId | INT | FK |
| stockId | INT | FK |
| normalizedScore | DECIMAL(5,2) | 0–100 |
| classification | ENUM | A_PLUS, A, B, C, D |
| All signal scores | DECIMAL(5,2) | 13 columns |
| warnings | JSON | Array of strings |
| rankedPosition | INT | |

**Unique index:** `(analysisRunId, stockId)`

### SetupCandidate

Trade plan per stock per run.

| Column | Type | Notes |
|---|---|---|
| analysisRunId | INT | FK |
| stockId | INT | FK |
| setupType | VARCHAR(50) | BREAKOUT, etc. |
| status | ENUM | BUY_SETUP, WAIT_FOR_BREAKOUT, etc. |
| breakoutLevel, entryLow, entryHigh | DECIMAL(12,2) | |
| stopLoss, target1, target2 | DECIMAL(12,2) | |
| riskPerShare, riskReward1, riskReward2 | DECIMAL(8,4) | |
| recommendedQuantity | INT | |
| capitalUsed, maximumLoss | DECIMAL(14,2) | |
| triggerCondition, invalidationCondition | TEXT | |
| reason | TEXT | |
| confidenceScore | DECIMAL(5,2) | |

**Unique index:** `(analysisRunId, stockId)`

### WatchlistEntry

Final watchlist per run.

| Column | Type | Notes |
|---|---|---|
| analysisRunId | INT | FK |
| stockId | INT | FK |
| rank | INT | 1-N |
| normalizedScore | DECIMAL(5,2) | |
| status | ENUM | Same as SetupCandidate |
| entryLow, entryHigh | DECIMAL(12,2) | |
| stopLoss, target1 | DECIMAL(12,2) | |
| riskReward1 | DECIMAL(8,4) | |
| reason | TEXT | |

**Unique index:** `(analysisRunId, stockId)`

### PaperTrade

| Column | Type | Notes |
|---|---|---|
| stockId | INT | FK |
| analysisRunId | INT | FK, nullable |
| entryDate, exitDate | DATE | |
| entryPrice, exitPrice | DECIMAL(12,2) | |
| quantity | INT | |
| direction | ENUM | LONG |
| pnl | DECIMAL(14,2) | |
| pnlPercent | DECIMAL(8,4) | |
| fees | DECIMAL(10,2) | |
| notes | TEXT | |

### Settings (Singleton)

| Column | Type | Default |
|---|---|---|
| id | INT (PK, always 1) | |
| capital | DECIMAL(14,2) | 20000 |
| riskPercent | DECIMAL(5,2) | 1.00 |
| minRiskReward | DECIMAL(4,2) | 2.00 |
| watchlistSize | INT | 10 |
| createdAt, updatedAt | DATETIME | |

## Key Indexes

- `Stock.symbol` — UNIQUE
- `DailyMetric(stockId, tradingDate)` — UNIQUE
- `AnalysisResult(analysisRunId, stockId)` — UNIQUE
- `SetupCandidate(analysisRunId, stockId)` — UNIQUE
- `WatchlistEntry(analysisRunId, stockId)` — UNIQUE
- `ReportRow(stockId, tradingDate, reportType)` — composite
- `Upload(checksum)` — for duplicate detection
- `Upload(reportType, tradingDate)` — for upload lookup
- `PaperTrade(stockId, entryDate)` — for history queries
