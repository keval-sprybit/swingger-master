// Market condition classification.
//
// Where index data is available (as bhavcopy bars for index symbols such as
// NIFTY / NIFTY 50 / BANKNIFTY), we classify overall market tone. When no
// index history is present, we fall back to a breadth proxy derived from the
// day's report universe (advancers vs decliners and 52-week highs vs lows).
export function classifyMarket(input) {
    // Prefer index-based analysis when available.
    if (input.indexSubset && input.indexSubset.length > 0) {
        const valid = input.indexSubset.filter((x) => x.return20d != null && x.return5d != null);
        if (valid.length > 0) {
            const avgR20 = valid.reduce((a, b) => a + (b.return20d ?? 0), 0) / valid.length;
            const avgR5 = valid.reduce((a, b) => a + (b.return5d ?? 0), 0) / valid.length;
            const above = valid.filter((x) => x.above20dma === true).length;
            const ratio = above / valid.length;
            let condition = "NEUTRAL";
            if (avgR20 > 0 && avgR5 >= 0 && ratio >= 0.5)
                condition = "BULLISH";
            else if (avgR20 < 0 && avgR5 <= 0 && ratio <= 0.5)
                condition = "BEARISH";
            return {
                condition,
                reason: `Index trend: 20d change ${avgR20.toFixed(1)}%, 5d change ${avgR5.toFixed(1)}%, ${Math.round(ratio * 100)}% above 20 DMA.`,
            };
        }
    }
    // Breadth proxy from the report universe.
    const total = input.advancers + input.decliners;
    let condition = "NEUTRAL";
    let reason = "No index data; using report breadth as a proxy.";
    if (total > 0) {
        const breadth = input.advancers / total;
        if (breadth >= 0.55 && input.week52High >= input.week52Low) {
            condition = "BULLISH";
            reason = `Breadth positive (${Math.round(breadth * 100)}% advancers) with more 52-week highs than lows.`;
        }
        else if (breadth <= 0.4 && input.week52Low > input.week52High) {
            condition = "BEARISH";
            reason = `Breadth negative (${Math.round((1 - breadth) * 100)}% decliners) with more 52-week lows than highs.`;
        }
        else {
            reason = `Breadth mixed (${Math.round(breadth * 100)}% advancers, ${input.week52High} highs / ${input.week52Low} lows).`;
        }
    }
    return { condition, reason };
}
//# sourceMappingURL=market.js.map