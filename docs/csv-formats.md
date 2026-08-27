# CSV Formats

This document describes the 8 NSE report types supported by the analyzer, their expected CSV structures, and how the system detects them.

## Column Alias Normalization

All headers are normalized before matching:

- Lowercased
- Punctuation stripped (`.`, `,`, `/`, `(`, `)`, `-`, `%`)
- Multiple spaces collapsed to single space
- Leading/trailing whitespace trimmed

**Example mappings:**

| Raw Header | Normalized |
|---|---|
| `VOLUME (Shares)` | `volume shares` |
| `PREV. CLOSE` | `prev close` |
| `%CHNG` | `chng` |
| `TODAY - % CHNG` | `today chng` |
| `1 WEEK - AVG. VOLUME` | `1 week avg volume` |
| `New 52W/H price` | `new 52w h price` |
| `TRADE PRICE / WEIGHTED AVG. PRICE` | `trade price weighted avg price` |

## 1. Most Active Volume

**Filename keywords:** `volume`, `MA`, `equities`
**Header:** `SYMBOL, OPEN, HIGH, LOW, PREV. CLOSE, LTP, %CHNG, VOLUME (Shares), VALUE, CA`

| Column | Parsed Field | Type |
|---|---|---|
| SYMBOL | symbol | string |
| OPEN | open | decimal |
| HIGH | high | decimal |
| LOW | low | decimal |
| PREV. CLOSE | prevClose | decimal |
| LTP | ltp | decimal |
| %CHNG | changePercent | decimal |
| VOLUME (Shares) | volume | bigint |
| VALUE | turnover | decimal |

## 2. Most Active Value

Same CSV structure as Most Active Volume. Disambiguated by filename containing `value` (vs `volume`).

**Filename keywords:** `value`, `MA`, `equities`

## 3. Volume Gainers

**Filename keywords:** `volume gainers`, `LA`
**Header:** `SYMBOL, SECURITY, TODAY - VOLUME, 1 WEEK - AVG. VOLUME, 1 WEEK - CHANGE, 2 WEEK - AVG. VOLUME, 2 WEEK - CHANGE, TODAY - LTP, TODAY - % CHNG, TODAY - TURNOVER`

| Column | Parsed Field | Type |
|---|---|---|
| SYMBOL | symbol | string |
| SECURITY | security | string |
| TODAY - VOLUME | todayVolume | bigint |
| 1 WEEK - AVG. VOLUME | avgVolume1w | bigint |
| 1 WEEK - CHANGE | volumeChange1w | decimal |
| 2 WEEK - AVG. VOLUME | avgVolume2w | bigint |
| 2 WEEK - CHANGE | volumeChange2w | decimal |
| TODAY - LTP | todayLtp | decimal |
| TODAY - % CHNG | changePercent | decimal |
| TODAY - TURNOVER | todayTurnover | decimal |

**Derived fields:** `volumeRatio1w = todayVolume / avgVolume1w`, `volumeRatio2w = todayVolume / avgVolume2w`

## 4. 52-Week High

**Filename keywords:** `52 week high`, `52weekhigh`
**Header:** `Symbol, Series, LTP, %chng, New 52W/H price, Prev.High, Prev. High Date`

| Column | Parsed Field | Type |
|---|---|---|
| Symbol | symbol | string |
| Series | series | string |
| LTP | ltp | decimal |
| %chng | changePercent | decimal |
| New 52W/H price | new52wHigh | decimal |
| Prev.High | previousHigh | decimal |
| Prev. High Date | highDate | date |

## 5. 52-Week Low

**Filename keywords:** `52 week low`, `52weeklow`
**Header:** `Symbol, Series, LTP, %chng, New 52W/L price, Prev.Low, Prev. Low Date`

| Column | Parsed Field | Type |
|---|---|---|
| Symbol | symbol | string |
| Series | series | string |
| LTP | ltp | decimal |
| %chng | changePercent | decimal |
| New 52W/L price | new52wLow | decimal |
| Prev.Low | previousLow | decimal |
| Prev. Low Date | lowDate | date |

## 6. Top 20 Gainers

**Filename keywords:** `gainers`, `T20`, `GL` (without `loosers`/`losers`)
**Header:** `SYMBOL, OPEN, HIGH, LOW, PREV. CLOSE, LTP, %CHNG, VOLUME (Shares), VALUE, CA`

Same CSV structure as Most Active Volume/Value. Disambiguated by filename keywords.

## 7. Top 20 Losers

**Filename keywords:** `loosers`, `losers`, `T20`, `GL` (with `loosers`/`losers`)
**Header:** Same as Top 20 Gainers.

## 8. Large Deals

**Filename keywords:** `large deals`, `BULK`
**Header:** `DATE, SYMBOL, SECURITY NAME, CLIENT NAME, BUY/SELL, QUANTITY TRADED, TRADE PRICE / WEIGHTED AVG. PRICE, REMARKS`

| Column | Parsed Field | Type |
|---|---|---|
| DATE | tradeDate | date (row-level deal date; NOT the report trading date) |
| SYMBOL | symbol | string |
| SECURITY NAME | securityName | string |
| CLIENT NAME | clientName | string |
| BUY/SELL | buySell | BUY/SELL/NET |
| QUANTITY TRADED | quantityTraded | bigint |
| TRADE PRICE / WEIGHTED AVG. PRICE | tradePrice | decimal |
| REMARKS | remarks | string |

## Date Detection — Report Date vs Row-Level Deal Date

The system distinguishes two dates:

1. **Report / trading date** (`tradingDate` on `csv_uploads`) — which trading day the report belongs to. This determines the `uploads/YYYY/MM/DD/` folder.
2. **Row-level deal date** (`trade_date` on `large_deals`) — for Bulk/Large Deals, the DATE column inside individual rows is the *transaction/deal date*.

### Report date resolution order

1. **Explicit user-forced date** (Upload page → "Force Date"), if provided → overrides everything for the report's trading date.
2. **Reliable report filename date** (e.g. `Large-deals-BULK-27-Aug-2026.csv` → `27-Aug-2026`).
3. **Report-level date/header metadata** (a genuine report-level DATE column) — only for non-deal report types.
4. **Row-level dates as a last fallback** — never used to pick the report date for Bulk Deals.

### Important: Bulk Deals

For `LARGE_DEALS`, the CSV `DATE` column is the **deal date**, NOT the report date. It must never automatically determine the report's trading date.

Example — file `Large-deals-BULK-27-Aug-2026.csv` whose rows carry `DATE = 26-Aug-2026`:

| Field | Value |
|---|---|
| report/trading date (`csv_uploads.trading_date`) | `2026-08-27` |
| filename date (`csv_uploads.filename_date`) | `2026-08-27` |
| detected date (`csv_uploads.detected_date`) | `2026-08-27` |
| row-level deal date (`large_deals.trade_date`) | `2026-08-26` |

Both values are preserved independently. The physical file is stored under `uploads/2026/08/27/` even though the deal rows are dated `26-Aug`.

### Other report types

Files like MA volume/value, gainers, losers, and 52-week reports do not contain a row-level deal DATE column, so the filename date (or a forced date) is used directly.

## Unknown Reports

When header aliases don't match any known schema, the report is marked `NEEDS_REVIEW` and must be manually assigned a type via the Upload page override before analysis.
