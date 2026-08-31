// Conservative trade-structure & decision engine.
//
// This replaces the naive "recent high/low + percentage buffer" approach with a
// structure-based one that uses REAL price history (TechnicalIndicators) when
// available and degrades gracefully to report-level OHLC when it is not.
//
// Key behaviours:
//   - Breakout level comes from real structure (swing high / resistance) with a REASON.
//   - Stop loss comes from real structure (recent swing low / ATR) with a REASON.
//   - Targets come from technical levels (next resistance / swing high / ATR), never
//     artificially forced to 1:2.
//   - Conservative statuses: WAIT BREAKOUT / BREAKOUT APPROACHING / BREAKOUT CONFIRMED /
//     BREAKOUT FAILED / ENTRY ACTIVE / MISSED (DO NOT CHASE) / WEAK BREAKOUT / AVOID /
//     INSUFFICIENT DATA / NO TRADE.
const fmt = (x) => x.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const round2 = (x) => Math.round(x * 100) / 100;
const round4 = (x) => Math.round(x * 10000) / 10000;
export function computeStructure(input) {
    const { metric, score, tech, marketCondition, mode, settings } = input;
    const warnings = [...score.warnings];
    const ltp = metric.ltp;
    const base = {
        setupType: null,
        status: "INSUFFICIENT_DATA",
        currentPrice: ltp,
        breakoutLevel: null,
        breakoutReason: null,
        breakoutStatus: null,
        entryLow: null,
        entryHigh: null,
        stopLoss: null,
        stopLossReason: null,
        target1: null,
        target1Reason: null,
        target2: null,
        riskPerShare: null,
        reward1PerShare: null,
        reward2PerShare: null,
        riskReward1: null,
        riskReward2: null,
        capitalAvailable: settings.capital,
        riskPercent: settings.riskPercent,
        maximumRisk: round2((settings.capital * settings.riskPercent) / 100),
        recommendedQuantity: null,
        capitalUsed: null,
        maximumLoss: null,
        triggerCondition: null,
        invalidationCondition: null,
        reason: null,
        warnings,
        confidenceScore: null,
        mode,
        trend: tech?.trend ?? null,
        marketCondition,
        whySelected: [],
        insufficientData: tech ? !tech.available : false,
    };
    if (ltp === null) {
        base.reason = "No last traded price available; cannot build a setup.";
        return base;
    }
    // ---- Breakout level & reason (real structure) -------------------------
    let breakoutLevel = null;
    let breakoutReason = null;
    if (tech?.breakoutLevel != null) {
        breakoutLevel = tech.breakoutLevel;
        breakoutReason = tech.breakoutReason;
    }
    else if (metric.breakoutLevel != null) {
        breakoutLevel = metric.breakoutLevel;
        breakoutReason = metric.breakoutReason ?? "Recent swing high / resistance";
    }
    else if (metric.prevHighPrice != null && metric.prevHighPrice >= ltp) {
        breakoutLevel = metric.prevHighPrice;
        breakoutReason = "Previous day high";
    }
    else if (metric.highPrice != null && metric.highPrice >= ltp) {
        breakoutLevel = metric.highPrice;
        breakoutReason = "Today's high";
    }
    else {
        breakoutLevel = ltp * 1.03;
        breakoutReason = "No confirmed structure — estimated 3% above current price";
        warnings.push("No real resistance level available; breakout estimate is approximate.");
    }
    // ---- Stop loss & reason (real structure / ATR) ------------------------
    let stopLevel = null;
    let stopReason = null;
    if (tech?.structure.recent?.swingLow != null) {
        stopLevel = tech.structure.recent.swingLow;
        stopReason = "Below recent swing low (structure)";
    }
    else if (tech?.supportResistance.support?.level != null) {
        stopLevel = tech.supportResistance.support.level;
        stopReason = tech.supportResistance.support.reason;
    }
    else if (metric.support != null) {
        stopLevel = metric.support;
        stopReason = metric.supportReason ?? "Technical support";
    }
    else if (metric.prevLowPrice != null) {
        stopLevel = metric.prevLowPrice;
        stopReason = "Previous day low";
    }
    else if (metric.lowPrice != null) {
        stopLevel = metric.lowPrice;
        stopReason = "Today's low";
    }
    // ATR-based fallback only when no structural stop exists (a real structural
    // stop is always preferred — it is more robust than an arbitrary ATR offset).
    const atr = tech?.atr14 ?? null;
    if (atr && stopLevel == null) {
        stopLevel = round4(ltp - 1.5 * atr);
        stopReason = `1.5 ATR below current price (ATR ${atr.toFixed(2)})`;
    }
    if (stopLevel == null) {
        base.reason = "No support/stop level available; insufficient data for a stop loss.";
        base.status = "INSUFFICIENT_DATA";
        base.insufficientData = true;
        return base;
    }
    // ---- Entry zone --------------------------------------------------------
    const buffer = atr ? Math.max(0.002, atr * 0.3 / ltp) : 0.005;
    const entryLow = round4(breakoutLevel * (1 + buffer));
    const entryHigh = round4(breakoutLevel * (1 + 2 * buffer));
    if (stopLevel >= entryLow) {
        base.breakoutLevel = round4(breakoutLevel);
        base.breakoutReason = breakoutReason;
        base.entryLow = entryLow;
        base.entryHigh = entryHigh;
        base.stopLoss = round4(stopLevel);
        base.stopLossReason = stopReason;
        base.status = "NO_TRADE";
        base.reason = "Stop loss sits at/above the entry zone — no valid risk/reward. No trade.";
        base.warnings.push("No valid risk/reward (stop >= entry).");
        return base;
    }
    const riskPerShare = round4(entryLow - stopLevel);
    if (riskPerShare <= 0) {
        base.status = "NO_TRADE";
        base.reason = "Non-positive risk per share — cannot define a valid setup. No trade.";
        return base;
    }
    // ---- Targets (technical, not forced 1:2) ------------------------------
    // Target 1: nearest resistance above entry, else ATR extension.
    let target1;
    let target1Reason;
    const resistanceAbove = tech?.supportResistance.resistance;
    if (resistanceAbove?.level != null && resistanceAbove.level > entryHigh) {
        target1 = round4(resistanceAbove.level);
        target1Reason = resistanceAbove.reason;
    }
    else {
        const atrExt = atr ? round4(entryLow + 2 * atr) : null;
        const swing = tech?.structure.last20?.swingHigh ?? null;
        const cand = [atrExt, swing].filter((x) => x != null && x > entryHigh).sort((a, b) => a - b);
        target1 = round4(cand[0] ?? entryLow * 1.06);
        target1Reason = atr
            ? "2 ATR above entry"
            : "Estimated 6% above entry (no stronger level)";
    }
    const target2 = round4(target1 + riskPerShare * (atr ? 2 : 1.5));
    const reward1 = round4(target1 - entryLow);
    const reward2 = round4(target2 - entryLow);
    const rr1 = round2(reward1 / riskPerShare);
    const rr2 = round2(reward2 / riskPerShare);
    // ---- Position sizing (risk-based, capped by capital) -------------------
    const maximumRisk = (settings.capital * settings.riskPercent) / 100;
    const qtyByRisk = Math.floor(maximumRisk / riskPerShare);
    const qtyByCapital = Math.floor(settings.capital / entryLow);
    const recommendedQty = Math.max(0, Math.min(qtyByRisk, qtyByCapital));
    const capitalUsed = round2(recommendedQty * entryLow);
    const maxLoss = round2(recommendedQty * riskPerShare);
    // ---- Breakout status (confirmation) ------------------------------------
    const extendedThreshold = atr ? 1.2 * atr : ltp * 0.01;
    const aboveBreakout = ltp >= breakoutLevel;
    const distPct = ltp > 0 ? ((breakoutLevel - ltp) / ltp) * 100 : 0;
    let breakoutStatus;
    if (!aboveBreakout) {
        if (distPct <= 3)
            breakoutStatus = "BREAKOUT APPROACHING";
        else
            breakoutStatus = "WAIT BREAKOUT";
    }
    else {
        // Price is at/above the breakout level.
        const farAbove = ltp > entryHigh;
        if (farAbove && (ltp - breakoutLevel) > extendedThreshold) {
            breakoutStatus = "MISSED — DO NOT CHASE";
        }
        else if (rr1 >= settings.minRiskReward) {
            breakoutStatus = "BREAKOUT CONFIRMED";
        }
        else {
            breakoutStatus = "WEAK BREAKOUT";
        }
    }
    // ---- Market-condition gating ------------------------------------------
    let status = "WATCH";
    const reasons = [];
    if (score.classification === "D" && rr1 < 1) {
        status = "AVOID";
        reasons.push("Weak score with poor risk/reward — avoid.");
    }
    else if (metric.is52wLow) {
        status = "AVOID";
        reasons.push("New 52-week low — not a long candidate.");
    }
    else if (marketCondition === "BEARISH") {
        status = metric.is52wHigh || rr1 >= settings.minRiskReward ? "WATCH" : "AVOID";
        if (status === "AVOID")
            reasons.push("Bearish market and setup not strong enough.");
        else
            reasons.push("Bearish market — watch only, require confirmation.");
    }
    else if (breakoutStatus === "BREAKOUT CONFIRMED") {
        if (metricsPassConfirmation(metric, tech)) {
            status = "ENTRY_ACTIVE";
            reasons.push("Price broke out and sustained with confirming volume.");
        }
        else {
            status = "BREAKOUT_CONFIRMED";
            reasons.push("Breakout above level; waiting for volume/close confirmation.");
        }
    }
    else if (breakoutStatus === "WEAK BREAKOUT") {
        status = "WEAK_BREAKOUT";
        reasons.push("Price above breakout but risk/reward below minimum.");
    }
    else if (breakoutStatus === "MISSED — DO NOT CHASE") {
        status = "MISSED";
        reasons.push("Price already extended well above the entry zone — do not chase.");
    }
    else if (breakoutStatus === "BREAKOUT APPROACHING") {
        status = "BREAKOUT_APPROACHING";
        reasons.push("Price is approaching the breakout level — prepare but do not enter.");
    }
    else {
        status = "WAIT_FOR_BREAKOUT";
        reasons.push("Price has not yet broken out. Wait for a confirmed break/sustain.");
    }
    const triggerCondition = `Enter long only on a confirmed breakout above ${fmt(breakoutLevel)} that SUSTAINS (not a spike) with volume confirmation. Preferred entry ${fmt(entryLow)}–${fmt(entryHigh)}.`;
    const invalidationCondition = `Invalidate if price closes back below ${fmt(breakoutLevel)} (failed breakout) or below stop ${fmt(stopLevel)}.`;
    const positive = score.signals.filter((s) => s.points > 0).length;
    const total = score.signals.length || 1;
    const confidenceRaw = (positive / total) * 100 *
        (rr1 >= settings.minRiskReward ? 1 : 0.6) *
        (status === "ENTRY ACTIVE" ? 1 : status === "WATCH" || status === "BREAKOUT CONFIRMED" ? 0.85 : 0.7);
    return {
        ...base,
        setupType: "BREAKOUT",
        status,
        breakoutLevel: round4(breakoutLevel),
        breakoutReason,
        breakoutStatus,
        entryLow,
        entryHigh,
        stopLoss: round4(stopLevel),
        stopLossReason: stopReason,
        target1,
        target1Reason,
        target2,
        riskPerShare,
        reward1PerShare: reward1,
        reward2PerShare: reward2,
        riskReward1: rr1,
        riskReward2: rr2,
        maximumRisk: round2(maximumRisk),
        recommendedQuantity: recommendedQty,
        capitalUsed,
        maximumLoss: maxLoss,
        triggerCondition,
        invalidationCondition,
        reason: reasons.length ? reasons.join(" ") : `Setup ${status}. Breakout ${fmt(breakoutLevel)}, entry ${fmt(entryLow)}–${fmt(entryHigh)}, stop ${fmt(stopLevel)}, R:R 1:${rr1.toFixed(1)}.`,
        confidenceScore: round2(Math.max(0, Math.min(100, confidenceRaw))),
        whySelected: buildWhy(metric, tech, status, breakoutStatus, rr1),
        insufficientData: false,
        technicalContext: tech
            ? {
                sma20: tech.sma20,
                sma50: tech.sma50,
                sma200: tech.sma200,
                rsi14: tech.rsi14,
                atr14: tech.atr14,
                relVolume: tech.relVolume,
                trend: tech.trend,
            }
            : undefined,
    };
}
function metricsPassConfirmation(metric, tech) {
    // Conservative: a breakout is only "ENTRY ACTIVE" when volume confirms and
    // price is not aberrational and risk/reward is acceptable. Real confirmation
    // would also require sustained closes intraday — here we proxy with volume.
    const rv = tech?.relVolume;
    if (rv != null && rv < 1.2)
        return false; // no volume confirmation
    if (metric.closePosition != null && metric.closePosition < 0.5)
        return false; // closed weak
    if (metric.is52wLow)
        return false;
    return true;
}
function buildWhy(metric, tech, status, breakoutStatus, rr1) {
    const why = [];
    if (metric.isVolumeGainer || (tech?.relVolume != null && tech.relVolume >= 1.5))
        why.push("Strong relative volume");
    if (metric.isTopGainer && metric.changePercent != null && metric.changePercent > 0)
        why.push("Positive momentum (top gainer)");
    if (tech?.sma20 != null && metric.ltp != null && metric.ltp > tech.sma20)
        why.push("Above 20 DMA");
    if (tech?.sma50 != null && metric.ltp != null && metric.ltp > tech.sma50)
        why.push("Above 50 DMA");
    if (metric.is52wHigh)
        why.push("Making new 52-week highs");
    if (metric.is52wLow)
        why.push("New 52-week low — avoid longs");
    if (breakoutStatus && breakoutStatus.includes("CONFIRMED"))
        why.push("Breakout confirmed");
    if (status === "ENTRY_ACTIVE")
        why.push("Entry active — confirmed break with volume");
    if (rr1 >= 2)
        why.push(`Good risk/reward (1:${rr1.toFixed(1)})`);
    if (tech?.trend === "BULLISH" || tech?.trend === "STRONG_BULLISH")
        why.push("Bullish trend structure");
    return why;
}
//# sourceMappingURL=structure.js.map