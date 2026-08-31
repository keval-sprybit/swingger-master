// Transparent scoring with explainable component breakdown.
//
// Two distinct models (Intraday and Swing) — never share a formula, so a stock
// can rank differently intraday vs. for tomorrow's swing.
//
// Double-counting protection: correlated report signals (a stock showing up in
// Top Gainers + Volume Gainers + Most Active for the same big move) are treated
// as one underlying factor with diminishing weights, NOT as independent strong
// signals.
const clamp01 = (x) => Math.max(0, Math.min(1, x));
function volumeStrength(m, tech) {
    let score = 0;
    const reasons = [];
    const ratio = m.volumeRatio1w ?? tech?.relVolume ?? null;
    if (ratio != null) {
        // 15 points split across volume expansion AND relative volume, so a stock
        // appearing in Volume Gainers does not double-count the same volume move.
        if (ratio >= 8)
            score = 10;
        else if (ratio >= 5)
            score = 9;
        else if (ratio >= 3)
            score = 8;
        else if (ratio >= 2)
            score = 7;
        else if (ratio >= 1.5)
            score = 5;
        else if (ratio >= 1)
            score = 3;
        reasons.push(`Volume ratio ${ratio.toFixed(1)}x`);
        if (m.isVolumeGainer)
            reasons.push("Classified as Volume Gainer");
        if (tech?.relVolume != null && tech.relVolume >= 2)
            reasons.push(`Relative volume ${tech.relVolume.toFixed(1)}x`);
    }
    else {
        reasons.push("No volume-ratio data");
    }
    return { score, max: 15, reason: reasons.join(" · ") || "No volume data" };
}
function momentumScoreFn(m) {
    const chg = m.changePercent;
    let score = 0;
    if (chg != null) {
        if (chg >= 8)
            score = 15;
        else if (chg >= 5)
            score = 13;
        else if (chg >= 3)
            score = 11;
        else if (chg >= 2)
            score = 9;
        else if (chg >= 1)
            score = 6;
        else if (chg >= 0)
            score = 3;
        else if (chg <= -8)
            score = 2;
    }
    const reasons = [];
    if (chg != null)
        reasons.push(`1-day change ${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`);
    if (m.isTopGainer)
        reasons.push("Top Gainer");
    if (m.isTopLoser)
        reasons.push("Top Loser");
    return { score, max: 15, reason: reasons.join(" · ") || "No momentum data" };
}
function technicalTrendComponent(tech) {
    if (!tech || !tech.trend)
        return { score: 3, max: 15, reason: "Insufficient history for trend" };
    const map = {
        STRONG_BULLISH: 15,
        BULLISH: 13,
        NEUTRAL: 7,
        BEARISH: 4,
        STRONG_BEARISH: 2,
    };
    return { score: map[tech.trend], max: 15, reason: tech.trendReasons.slice(0, 3).join(" · ") || tech.trend };
}
function breakoutComponent(m, setup) {
    let score = 0;
    const reasons = [];
    if (setup?.breakoutLevel != null) {
        reasons.push(`Breakout level ${setup.breakoutLevel.toFixed(2)}`);
        if (setup.breakoutReason)
            reasons.push(setup.breakoutReason);
    }
    if (m.is52wHigh) {
        score += 8;
        reasons.push("At 52-week high (extension context)");
    }
    const proximity = setup?.breakoutLevel != null && setup.currentPrice
        ? ((setup.breakoutLevel - setup.currentPrice) / setup.currentPrice) * 100
        : null;
    if (proximity != null && proximity >= 0 && proximity <= 5) {
        score += 6;
        reasons.push("Price within 5% of breakout level");
    }
    else if (proximity != null && proximity < 0) {
        score += 10;
        reasons.push("Price above breakout level (fresh breakout / retest)");
    }
    if (m.is52wLow) {
        score = Math.max(score, 1);
        reasons.push("52-week low warns against longs");
    }
    return { score: Math.min(score, 15), max: 15, reason: reasons.join(" · ") || "No breakout context" };
}
function relativeVolumeComponent(tech, m) {
    const rv = tech?.relVolume ?? null;
    let score = 0;
    if (rv != null) {
        if (rv >= 5)
            score = 10;
        else if (rv >= 3)
            score = 8;
        else if (rv >= 2)
            score = 6;
        else if (rv >= 1.5)
            score = 4;
        else if (rv >= 1)
            score = 2;
        return { score, max: 10, reason: `Relative volume ${rv.toFixed(2)}x vs 20-day avg` };
    }
    if (m.volumeRatio1w != null) {
        // fall back to the report's own ratio, discounted (already partly counted in volume strength)
        const r = m.volumeRatio1w;
        if (r >= 3)
            score = 5;
        else if (r >= 2)
            score = 4;
        else if (r >= 1.5)
            score = 2;
        return { score, max: 10, reason: `Report volume ratio ${r.toFixed(1)}x (fallback)` };
    }
    return { score, max: 10, reason: "No relative-volume data" };
}
function persistenceComponent(persistence) {
    if (!persistence || persistence.total === 0) {
        return { score: 0, max: 15, reason: "No multi-snapshot persistence available" };
    }
    const frac = persistence.count / persistence.total;
    const score = Math.round(frac * 15 * 10) / 10;
    return { score, max: 15, reason: `Signal persisted ${persistence.count}/${persistence.total} snaps` };
}
function marketComponent(marketCondition) {
    if (!marketCondition)
        return { score: 2, max: 5, reason: "No market data" };
    const map = { BULLISH: 5, NEUTRAL: 3, BEARISH: 1 };
    return { score: map[marketCondition], max: 5, reason: `Market ${marketCondition}` };
}
function riskRewardComponent(setup, max) {
    if (!setup || setup.riskReward1 == null)
        return { score: 0, max, reason: "No risk/reward computed" };
    const rr = Number(setup.riskReward1);
    let score = 0;
    if (rr >= 3)
        score = max;
    else if (rr >= 2)
        score = Math.round(max * 0.85);
    else if (rr >= 1.5)
        score = Math.round(max * 0.6);
    else if (rr >= 1)
        score = Math.round(max * 0.35);
    else
        score = 0;
    return { score, max, reason: `R:R 1:${rr.toFixed(1)}` };
}
function priceStructureComponent(tech) {
    const max = 10;
    if (!tech || !tech.structure.last20)
        return { score: 0, max, reason: "Insufficient structure data" };
    let score = 0;
    const reasons = [];
    if (tech.sma20 != null && tech.sma50 != null && tech.sma20 > tech.sma50) {
        score += 4;
        reasons.push("20 DMA > 50 DMA");
    }
    if (tech.trend === "BULLISH" || tech.trend === "STRONG_BULLISH") {
        score += 3;
        reasons.push(`Trend ${tech.trend}`);
    }
    if (tech.return20d != null && tech.return20d > 5) {
        score += 3;
        reasons.push(`20d return +${tech.return20d.toFixed(1)}%`);
    }
    return { score: Math.min(score, 10), max, reason: reasons.join(" · ") || "Neutral structure" };
}
function dataQualityComponent(dq) {
    const v = dq ?? 0;
    return { score: Math.round(v * 5 * 10) / 10, max: 5, reason: `Data quality ${Math.round(v * 100)}%` };
}
export function computeExplainableScore(input) {
    const { mode, metric, tech, marketCondition, setup, persistence, dataQuality } = input;
    const components = [];
    const why = [];
    const warnings = [];
    const vs = volumeStrength(metric, tech);
    const mom = momentumScoreFn(metric);
    const trend = technicalTrendComponent(tech);
    const bo = breakoutComponent(metric, setup);
    const rv = relativeVolumeComponent(tech, metric);
    const pers = persistenceComponent(persistence);
    const mk = marketComponent(marketCondition);
    const rrMax = mode === "INTRADAY" ? 5 : 10;
    const rr = riskRewardComponent(setup, rrMax);
    const ps = mode === "SWING" ? priceStructureComponent(tech) : { score: 0, max: 0, reason: "" };
    const dq = mode === "SWING" ? dataQualityComponent(dataQuality) : { score: 0, max: 0, reason: "" };
    if (mode === "INTRADAY") {
        components.push({ key: "volume_strength", label: "Volume Strength", ...vs }, { key: "price_momentum", label: "Price Momentum", ...mom }, { key: "signal_persistence", label: "Signal Persistence", ...pers }, { key: "technical_trend", label: "Technical Trend", ...trend }, { key: "breakout_setup", label: "Breakout Setup", ...bo }, { key: "relative_volume", label: "Relative Volume", ...rv }, { key: "market_condition", label: "Market Condition", ...mk }, { key: "risk_reward", label: "Risk/Reward", ...rr });
    }
    else {
        components.push({ key: "trend", label: "Trend", ...trend }, { key: "price_momentum", label: "Price Momentum", ...mom }, { key: "volume_strength", label: "Volume Strength", ...vs }, { key: "breakout_setup", label: "Breakout / Resistance Setup", ...bo }, { key: "price_structure", label: "Historical Price Structure", ...ps }, { key: "intraday_persistence", label: "Intraday Persistence", ...pers }, { key: "market_condition", label: "Market Condition", ...mk }, { key: "risk_reward", label: "Risk/Reward", ...rr }, { key: "data_quality", label: "Data Quality", ...dq });
    }
    const total = components.reduce((a, c) => a + c.score, 0);
    for (const c of components) {
        if (c.score >= c.max * 0.7 && c.max > 0)
            why.push(c.reason);
    }
    if (metric.is52wHigh)
        why.push("Making new 52-week highs");
    if (metric.isVolumeGainer)
        why.push("Unusual volume expansion");
    if (tech?.relVolume != null && tech.relVolume >= 1.5)
        why.push("Strong relative volume");
    if (tech?.sma20 != null && metric.ltp != null && metric.ltp > tech.sma20)
        why.push("Above 20 DMA");
    if (tech?.sma50 != null && metric.ltp != null && metric.ltp > tech.sma50)
        why.push("Above 50 DMA");
    if (setup?.breakoutLevel != null && metric.ltp != null && metric.ltp < setup.breakoutLevel) {
        const dist = ((setup.breakoutLevel - metric.ltp) / metric.ltp) * 100;
        why.push(`Near breakout (${dist.toFixed(1)}% below level)`);
    }
    if (persistence && persistence.count >= 2)
        why.push(`Intraday signal persistence ${persistence.count}/${persistence.total}`);
    if (mode === "SWING" && dataQuality != null && dataQuality < 0.5) {
        warnings.push("Limited historical price data — treat result with lower confidence.");
    }
    if (metric.changePercent != null && metric.changePercent > 10) {
        warnings.push("Large one-day move — elevated chase/volatility risk.");
    }
    if (metric.is52wLow)
        warnings.push("New 52-week low — not a long candidate.");
    if (marketCondition === "BEARISH")
        warnings.push("Bearish market — require stronger setups and smaller size.");
    if (metric.ltp != null && metric.ltp < 10)
        warnings.push("Low-priced stock — higher risk / lower liquidity premium.");
    return { total, components, why: [...new Set(why)], warnings, rename: {} };
}
//# sourceMappingURL=scoring.js.map