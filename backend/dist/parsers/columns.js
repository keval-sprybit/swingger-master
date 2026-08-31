import { detectDateFromFilename, parseDate } from "../utils/date.js";
// ---------------------------------------------------------------------------
// Header normalization
// ---------------------------------------------------------------------------
// Lowercase, strip punctuation, collapse whitespace. This makes "VOLUME (Shares)",
// "volume (shares)" and " Volume-Shares " all resolve to "volume shares".
export function normalizeHeader(header) {
    return header
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}
export const REPORT_SCHEMAS = [
    {
        type: "MOST_ACTIVE_VOLUME",
        label: "Most Active by Volume",
        required: ["symbol", "open", "high", "low", "prevClose", "ltp", "chng", "volume", "value"],
        filenameHints: ["volume", "vol"],
        columns: {
            symbol: ["symbol"],
            open: ["open"],
            high: ["high"],
            low: ["low"],
            prevClose: ["prev close", "prevclose"],
            ltp: ["ltp"],
            chng: ["chng", "%chng", "change"],
            volume: ["volume shares", "volume"],
            value: ["value"],
            ca: ["ca", "corporate action", "c a"],
        },
    },
    {
        type: "MOST_ACTIVE_VALUE",
        label: "Most Active by Value",
        required: ["symbol", "open", "high", "low", "prevClose", "ltp", "chng", "volume", "value"],
        filenameHints: ["value", "val"],
        columns: {
            symbol: ["symbol"],
            open: ["open"],
            high: ["high"],
            low: ["low"],
            prevClose: ["prev close", "prevclose"],
            ltp: ["ltp"],
            chng: ["chng", "%chng", "change"],
            volume: ["volume shares", "volume"],
            value: ["value"],
            ca: ["ca", "corporate action", "c a"],
        },
    },
    {
        type: "VOLUME_GAINERS",
        label: "Volume Gainers",
        required: ["symbol", "todayVolume", "avgVol1w", "todayLtp", "todayChng", "todayTurnover"],
        filenameHints: ["volume gainer", "volume-gainer", "gainers", "la-volume", "vol-gain"],
        columns: {
            symbol: ["symbol"],
            security: ["security"],
            todayVolume: ["today volume"],
            avgVol1w: ["1 week avg volume", "week avg volume", "avg volume 1w"],
            volChng1w: ["1 week change", "week change"],
            avgVol2w: ["2 week avg volume", "avg volume 2w"],
            volChng2w: ["2 week change"],
            todayLtp: ["today ltp"],
            todayChng: ["today chng", "today % chng"],
            todayTurnover: ["today turnover"],
        },
    },
    {
        type: "WEEK52_HIGH",
        label: "New 52 Week High",
        required: ["symbol", "series", "ltp", "chng", "new52wHigh", "prevHigh"],
        filenameHints: ["52weekhigh", "52 week high", "weekhigh", "high"],
        columns: {
            symbol: ["symbol"],
            series: ["series"],
            ltp: ["ltp"],
            chng: ["chng", "%chng", "change"],
            new52wHigh: ["new 52w h price", "new 52w high", "52w high"],
            prevHigh: ["prev high"],
            prevHighDate: ["prev high date"],
        },
    },
    {
        type: "WEEK52_LOW",
        label: "New 52 Week Low",
        required: ["symbol", "series", "ltp", "chng", "new52wLow", "prevLow"],
        filenameHints: ["52weeklow", "52 week low", "weeklow", "low"],
        columns: {
            symbol: ["symbol"],
            series: ["series"],
            ltp: ["ltp"],
            chng: ["chng", "%chng", "change"],
            new52wLow: ["new 52w l price", "new 52w low", "52w low"],
            prevLow: ["prev low"],
            prevLowDate: ["prev low date"],
        },
    },
    {
        type: "TOP_GAINERS",
        label: "Top 20 Gainers",
        required: ["symbol", "open", "high", "low", "prevClose", "ltp", "chng", "volume", "value"],
        filenameHints: ["gainers", "gainer", "gain"],
        columns: {
            symbol: ["symbol"],
            open: ["open"],
            high: ["high"],
            low: ["low"],
            prevClose: ["prev close", "prevclose"],
            ltp: ["ltp"],
            chng: ["chng", "%chng", "change"],
            volume: ["volume"],
            value: ["value"],
            ca: ["ca", "corporate action", "c a"],
        },
    },
    {
        type: "TOP_LOSERS",
        label: "Top 20 Losers",
        required: ["symbol", "open", "high", "low", "prevClose", "ltp", "chng", "volume", "value"],
        filenameHints: ["loosers", "losers", "loser", "loss"],
        columns: {
            symbol: ["symbol"],
            open: ["open"],
            high: ["high"],
            low: ["low"],
            prevClose: ["prev close", "prevclose"],
            ltp: ["ltp"],
            chng: ["chng", "%chng", "change"],
            volume: ["volume"],
            value: ["value"],
            ca: ["ca", "corporate action", "c a"],
        },
    },
    {
        type: "LARGE_DEALS",
        label: "Large Deals / Bulk Deals",
        required: ["date", "symbol", "security", "client", "buySell", "qtyTraded", "tradePrice", "remarks"],
        filenameHints: ["large", "bulk", "deal"],
        columns: {
            date: ["date"],
            symbol: ["symbol"],
            security: ["security name", "security"],
            client: ["client name", "client"],
            buySell: ["buy sell", "buysell"],
            qtyTraded: ["quantity traded"],
            tradePrice: ["trade price weighted avg price", "trade price", "weighted avg price"],
            remarks: ["remarks"],
        },
    },
    {
        type: "BHAVCOPY",
        label: "NSE Bhavcopy (Daily Price-Volume)",
        required: ["symbol", "open", "high", "low", "close", "prevClose", "volume", "value", "date"],
        filenameHints: ["bhavcopy", "bhav copy", "bhav", "cm", "bhavpr"],
        columns: {
            symbol: ["symbol", "tckrsymb", "tckr symb", "ticker symbol", "security id"],
            series: ["series", "sctysrs", "scty srs", "security series"],
            open: ["open", "opnpric", "oppnpric", "opn pric", "open price"],
            high: ["high", "hghpric", "hgh pric", "high price"],
            low: ["low", "lwpric", "lw pric", "low price"],
            close: ["close", "clspric", "cls pric", "closing price", "close price"],
            last: ["last", "lastpric", "last pric", "last price"],
            prevClose: ["prev close", "prevclose", "prvsclsgpric", "prvs cls pric", "previous close", "previous closing price"],
            ltp: ["last", "lastpric", "ltp"],
            chng: ["%chng", "change", "chng"],
            volume: ["traded quantity", "total traded quantity", "titled traded qty", "quantity", "volume", "tottrdqty", "trdqty", "ttltradgvol", "ttl tradg vol", "ttl trdg vol", "total traded vol"],
            value: ["total traded value", "traded value", "value", "tottrdval", "trdval", "ttltrfval", "ttl trf val", "total transfer value"],
            trades: ["total trades", "number of trades", "trades", "totaltrades", "ttlnboftxsexctd", "ttl nb of txs exctd"],
            vwap: ["vwap", "average price", "avg price"],
            deliveredQty: ["deliverable quantity", "deliverable qty", "delivered qty"],
            deliverablePct: ["%deliverble", "%deliverable", "deliverable quantity to traded quantity", "deliverable pct"],
            date: ["date", "timestamp", "traddt", "trad dt", "trade date", "trading date"],
            isin: ["isin"],
        },
    },
];
function headerMatchScore(schema, normHeaders) {
    const present = schema.required.filter((c) => (schema.columns[c] ?? []).some((variant) => normHeaders.includes(variant)));
    return present.length / schema.required.length;
}
// Build a map from canonical field -> actual file header for a given schema.
export function buildColumnMap(schema, headers) {
    const normHeaders = headers.map(normalizeHeader);
    const map = {};
    for (const canonical of Object.keys(schema.columns)) {
        const variants = schema.columns[canonical] ?? [];
        const idx = normHeaders.findIndex((nh) => variants.includes(nh));
        if (idx >= 0)
            map[canonical] = headers[idx];
    }
    return map;
}
export function detectReportType(headers, filename) {
    const normHeaders = headers.map(normalizeHeader);
    const lowerFile = filename.toLowerCase();
    const scored = REPORT_SCHEMAS.map((s) => ({ schema: s, score: headerMatchScore(s, normHeaders) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
    const matchedColumns = [...new Set(normHeaders)];
    if (scored.length === 0 || scored[0].score < 0.5) {
        return {
            reportType: "NEEDS_REVIEW",
            confidence: "LOW",
            needsReview: true,
            candidates: scored.map((x) => x.schema.type),
            matchedColumns,
        };
    }
    const best = scored[0];
    // Ambiguous tie: multiple schemas share the top score (e.g. MA Volume vs MA Value,
    // Top Gainers vs Top Losers). Disambiguate using filename hints.
    const tied = scored.filter((x) => x.score === best.score);
    if (tied.length > 1) {
        const byFile = tied.find((x) => x.schema.filenameHints.some((h) => lowerFile.includes(h)));
        if (byFile) {
            return {
                reportType: byFile.schema.type,
                confidence: "HIGH",
                needsReview: false,
                candidates: tied.map((x) => x.schema.type),
                matchedColumns,
            };
        }
        // Still ambiguous -> needs review
        return {
            reportType: "NEEDS_REVIEW",
            confidence: "LOW",
            needsReview: true,
            candidates: tied.map((x) => x.schema.type),
            matchedColumns,
        };
    }
    // Single best. If filename contradicts (e.g. file named "...value..." but headers
    // strongly suggest volume), we still trust headers but flag low confidence.
    const fileHintMatch = best.schema.filenameHints.some((h) => lowerFile.includes(h));
    return {
        reportType: best.schema.type,
        confidence: fileHintMatch ? "HIGH" : best.score >= 0.85 ? "HIGH" : "LOW",
        needsReview: false,
        candidates: [best.schema.type],
        matchedColumns,
    };
}
// Detect the report/trading date.
//
// IMPORTANT (Bulk Deals): For report types whose DATE column is a *row-level*
// transaction/deal date (LARGE_DEALS), that column must NOT determine the
// report's trading_date. The report date comes from the explicit/forced date,
// the filename date, or report-level header metadata. Row-level deal dates are
// captured separately in each row's `tradeDate` field and never used to pick
// the report/trading date.
//
// The report date resolution order is:
//   1. Explicit user-forced date (handled in uploadService)
//   2. Reliable report filename date
//   3. Report-level DATE column, but ONLY for non-deal report types (i.e. when
//      the DATE column represents the report date itself)
export function detectTradingDate(headers, rows, filename, reportType) {
    const normHeaders = headers.map(normalizeHeader);
    const filenameDate = detectDateFromFilename(filename);
    // For LARGE_DEALS the DATE column is a per-row deal date — it must not become
    // the report/trading date. Prefer the filename date.
    if (reportType === "LARGE_DEALS") {
        return {
            detectedDate: filenameDate,
            filenameDate,
            source: filenameDate ? "filename" : "none",
        };
    }
    // Non-deal reports: look for a genuine report-level DATE column (covers
    // "DATE", Bhavcopy's "TIMESTAMP", and Bhavcopy's "TradDt" header).
    const dateColIdx = normHeaders.findIndex((h) => h === "date" || h === "timestamp" || h === "traddt" || h === "trad dt");
    if (dateColIdx >= 0) {
        for (const row of rows.slice(0, 5)) {
            const raw = row[headers[dateColIdx]];
            const dt = parseDate(raw);
            if (dt)
                return { detectedDate: dt, filenameDate, source: "content" };
        }
    }
    return { detectedDate: filenameDate, filenameDate, source: filenameDate ? "filename" : "none" };
}
//# sourceMappingURL=columns.js.map