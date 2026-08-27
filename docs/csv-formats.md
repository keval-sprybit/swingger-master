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
| DATE | tradeDate | date |
| SYMBOL | symbol | string |
| SECURITY NAME | securityName | string |
| CLIENT NAME | clientName | string |
| BUY/SELL | buySell | BUY/SELL/NET |
| QUANTITY TRADED | quantityTraded | bigint |
| TRADE PRICE / WEIGHTED AVG. PRICE | tradePrice | decimal |
| REMARKS | remarks | string |

## Date Detection

Trading dates are extracted from:

1. **CSV `DATE` column** — for Large Deals
2. **Filename** — patterns like `DD-Mon-YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`
3. **None** — needs manual override

## Unknown Reports

When header aliases don't match any known schema, the report is marked `NEEDS_REVIEW` and must be manually assigned a type via the Upload page override before analysis.
