# NSE Swing Trading Analyzer

Local full-stack application that ingests NSE India end-of-day CSV reports, detects report types, stores structured data, runs scoring/analysis, and generates next-session watchlists for swing trading.

## Tech Stack

| Layer    | Technology                                       |
| -------- | ------------------------------------------------ |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend  | Node.js, Express, TypeScript, Prisma ORM        |
| Database | MySQL 8+ (managed via phpMyAdmin)               |
| Testing  | Vitest                                            |
| Parsing  | csv-parse, Zod, decimal.js                       |

## Quick Start

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **MySQL 8+** running locally (via phpMyAdmin, WAMP, XAMPP, or native)
- An empty MySQL database (e.g. `nse_swing_trading`)

### 1. Create Database

```sql
CREATE DATABASE nse_swing_trading;
-- Do NOT create tables manually; Prisma handles this
```

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials
```

`.env` contents:

```env
DATABASE_URL="mysql://root:password@localhost:3306/nse_swing_trading"
UPLOAD_DIR="uploads"
PORT=3001
```

### 3. Install & Migrate

```bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init

# Frontend
cd ../frontend
npm install
```

### 4. Run

```bash
# Terminal 1 - Backend (port 3001)
cd backend
npm run dev

# Terminal 2 - Frontend (port 5173)
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

## Features

- **CSV Upload & Detection** — Drag-and-drop multiple CSVs. Automatically detects 8 report types via header aliases and filename disambiguation. Ambiguous files marked as `NEEDS_REVIEW`.
- **Duplicate Protection** — SHA-256 checksum prevents re-importing the same file. Trading days are immutable; historical data is never overwritten.
- **Signal Scoring** — Multi-factor scoring engine (0–100 scale) with weighted components: volume expansion, momentum, 52-week highs/lows, activity, price action, large deals.
- **Trade Setups** — Automatic trade plan generation with entry zones, stop losses, targets (2:1 and 3:1), position sizing, and confidence scores.
- **Watchlist** — Daily ranked watchlist of the next session's best candidates with setup status and detailed plans.
- **Paper Trading** — Record paper trades, track win rate, profit factor, P&L, and max drawdown.
- **Dashboard** — At-a-glance view of today's analysis: top candidates, watchlist, sector exposure, volume summary.
- **Historical Charts** — Price/volume charts with moving averages and trend detection for any stock over the past year.

## Supported NSE Reports
| Report Type | Filename Keywords | Header Indicators |
|---|---|---|
| Most Active Volume | `volume`, `MA` | `SYMBOL, VOLUME (Shares), VALUE` |
| Most Active Value | `value`, `MA` | `SYMBOL, VOLUME (Shares), VALUE` |
| Volume Gainers | `volume gainers` | `1 WEEK - AVG. VOLUME` |
| 52-Week High | `52 week high`, `52WeekHigh` | `New 52W/H price` |
| 52-Week Low | `52 week low`, `52WeekLow` | `New 52W/L price` |
| Top 20 Gainers | `gainers`, `T20`, `GL` | `SYMBOL, LTP, %chng, VOLUME` |
| Top 20 Losers | `loosers`, `losers`, `T20`, `GL` | `SYMBOL, LTP, %chng, VOLUME` |
| Large Deals | `large deals`, `BULK` | `CLIENT NAME, BUY/SELL, QUANTITY` |

## Scoring Components

| Component | Max Points | Description |
|---|---|---|
| Activity Volume | 10 | Appears in Most Active Volume |
| Activity Value | 10 | Appears in Most Active Value |
| Volume Expansion | 20 | 1-week and 2-week volume ratios |
| Momentum | 10 | Daily % change (peak at 3–5%) |
| 52-Week Position | 20 | New high (+), new low (-), with volume/strength multipliers |
| Gainer Bonus | 8 | Top 20 Gainer |
| Loser Penalty | -10 | Top 20 Loser |
| Liquidity (Turnover) | 8 | Crude turnover bucket score |
| Large Deals | ±5 | Net institutional buy/sell |
| Price Action | 5 | Intraday strength + close position |
| Risk Penalty | -5 | Weak close or high intraday volatility |

## Risk Defaults

- **Capital**: ₹20,000
- **Risk per trade**: 1% (₹200 max loss)
- **Minimum Risk:Reward**: 1:2
- **Watchlist size**: 10

All configurable from the Settings page.

## Bulk Deals: Report Date vs Deal Date

Bulk/Large Deals CSVs carry a row-level `DATE` column that is the **deal/transaction date** — it is **not** the report's trading date. The report trading date is taken from the forced date, or the filename date, or report-level metadata. Row-level deal dates are preserved separately in `large_deals.trade_date`.

For example, `Large-deals-BULK-27-Aug-2026.csv` with rows dated `26-Aug` is stored with:
- `csv_uploads.trading_date = 2026-08-27` (report date → stored under `uploads/2026/08/27/`)
- `large_deals.trade_date  = 2026-08-26` (deal date, preserved)

The Upload page reports "Report Trading Date" and warns when row-level deal dates differ.

### Data Correction Script

If a Bulk Deals upload was previously mis-assigned to the wrong trading day (e.g. using its row-level deal date as the report date), run:

```bash
cd backend
npm run fix:bulk-deals-date -- "<originalFilename>" <correctDate> [<wrongDate>]
# e.g.
npm run fix:bulk-deals-date -- "Large-deals-BULK-27-Aug-2026.csv" 2026-08-27 2026-08-26
```

This:
1. Reassigns the upload's `tradingDate` to the correct report date
2. Moves its `LargeDeal` rows to the correct report date **without** changing their `trade_date`
3. Moves the physical CSV file to the correct `uploads/YYYY/MM/DD/` folder
4. Rebuilds daily metrics for both the old and new trading days

It is idempotent and never deletes rows.

### Backfill snapshot reuse (existing snapshots)

If snapshots were created *before* reuse-on-duplicate support existed, a
snapshot may be missing a report whose file was unchanged (e.g. an old snapshot
showing `7/8`). Backfill the missing report as a reuse reference:

```bash
cd backend
npm run fix:snapshot-reuse
```

This finds, per trading day + analysis type + snapshot version, any report type
that is missing and references the newest earlier snapshot's upload for it — no
new physical file or CSV rows are created. It is idempotent (skips reports
already present) and never deletes rows.

## Disclaimer

This application is for **educational and research purposes only**. It does not provide financial advice. Trading in equities involves risk. Always consult a SEBI-registered financial advisor before making investment decisions.

## Project Structure

```
swinnger-machine/
├── backend/
│   ├── prisma/schema.prisma          # Database schema (18+ models)
│   ├── scripts/fixBulkDealsDate.ts   # Data correction for mis-dated Bulk Deals
│   ├── scripts/fixSnapshotReuse.ts   # Backfill reuse refs for pre-feature snapshots
│   ├── src/
│   │   ├── parsers/                  # CSV detection, normalization, column maps
│   │   ├── analysis/                 # Signal engine, scoring, trade setup, types
│   │   ├── repositories/             # Database access (Prisma)
│   │   ├── services/                 # Business logic orchestration
│   │   ├── controllers/              # Request handlers
│   │   ├── routes/                   # API route definitions
│   │   ├── middleware/               # Error handler, multer upload config
│   │   └── utils/                    # Date parsing, decimal, serialization
│   ├── tests/                        # Vitest unit tests (68 tests)
│   └── vitest.config.ts
├── frontend/
│   ├── src/
│   │   ├── components/               # ScoreBadge, StatusBadge, Layout
│   │   ├── pages/                    # Dashboard, Upload, Candidates, etc.
│   │   ├── services/api.ts           # Axios API client
│   │   └── utils.ts                  # Formatters
│   └── index.html
├── docs/
│   ├── architecture.md
│   ├── csv-formats.md
│   ├── analysis-methodology.md
│   ├── database.md
│   └── api.md
└── README.md
```
"# swingger-master" 
"# swingger-master" 
