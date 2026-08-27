# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────┐
│                    React Frontend                     │
│  Dashboard │ Upload │ Candidates │ Charts │ Settings  │
└──────────────────────┬───────────────────────────────┘
                       │ HTTP (port 3001)
┌──────────────────────▼───────────────────────────────┐
│                  Express Backend                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Upload      │  │  Analysis    │  │  Settings   │ │
│  │  Controller  │  │  Controller  │  │  Controller │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                 │        │
│  ┌──────▼──────┐  ┌──────▼───────┐         │        │
│  │  Upload      │  │  Analysis   │         │        │
│  │  Service     │  │  Service    │         │        │
│  └──────┬──────┘  └──────┬───────┘         │        │
│         │                 │                 │        │
│  ┌──────▼──────┐  ┌──────▼───────┐         │        │
│  │  CSV        │  │  Signal     │  ┌──────▼──────┐  │
│  │  Parsers    │  │  Engine     │  │  Repos      │  │
│  │  +Normalize │  │  +Score     │  │  (Prisma)   │  │
│  │             │  │  +Setup     │  │             │  │
│  └─────────────┘  └──────────────┘  └─────────────┘  │
└──────────────────────┬───────────────────────────────┘
                       │ Prisma Client
┌──────────────────────▼───────────────────────────────┐
│                    MySQL 8+                           │
│              (phpMyAdmin managed)                     │
└──────────────────────────────────────────────────────┘
```

## Data Flow

### Upload Flow

```
User drops CSV → detectReportType() → detectTradingDate() →
  → buildColumnMap() → parseCsvBuffer() → normalize per report type
    → checksum (SHA-256) → store raw CSV in uploads/YYYY/MM/DD/
      → saveStocks() → saveReportRows() → rebuildDailyMetrics()
```

### Analysis Flow

```
User clicks "Run Analysis" → getTodayMetrics() →
  → computeSignals() for each stock → computeScores()
    → rank by normalizedScore → computeTradeSetup() for top-N
      → build watchlist → save to AnalysisRun
```

### Key Design Decisions

1. **Immutable Historical Data** — Once a trading day's metrics are computed, they are never overwritten. Multiple same-day uploads use INTRA versioning and coexist as report rows.

2. **Column-Alias Detection** — NSE headers are inconsistent across reports and change over time. The alias system normalizes headers by stripping punctuation and mapping synonyms, making detection resilient.

3. **Separation of Concerns** — Parsing, analysis, storage, and API layers are strictly separated. Each module has a single responsibility and can be tested independently.

4. **Decimal Precision** — All financial calculations use `decimal.js` to avoid floating-point errors. Position sizes are floored to whole shares.

## Module Responsibilities

| Module | Responsibility |
|---|---|
| `parsers/columns.ts` | Header alias map, report type detection, date detection, column mapping |
| `parsers/normalize.ts` | Per-report-type data normalization into a common format |
| `parsers/index.ts` | Orchestration: detect → build map → parse → normalize → validate |
| `analysis/types.ts` | TypeScript interfaces for MetricInput, ScoreResult, TradeSetupResult |
| `analysis/signals.ts` | Compute per-factor signal scores and aggregate normalized 0–100 score |
| `analysis/setup.ts` | Trade plan generation: entry, stop, targets, position sizing, status |
| `repositories/` | Prisma-based data access layer (CRUD for all models) |
| `services/uploadService.ts` | Full upload pipeline orchestration |
| `services/analysisService.ts` | Full analysis pipeline orchestration |
| `middleware/errorHandler.ts` | Global Express error handler (Prisma, Zod, multer errors) |
| `middleware/upload.ts` | Multer config: CSV only, 25MB limit |
