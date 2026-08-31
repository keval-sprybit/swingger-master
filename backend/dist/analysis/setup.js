function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
}
function round2(x) {
    return Math.round(x * 100) / 100;
}
function round4(x) {
    return Math.round(x * 10000) / 10000;
}
function fmt(x) {
    return x.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
export function computeTradeSetup(m, score, settings) {
    const base = {
        setupType: null,
        status: "INSUFFICIENT_DATA",
        currentPrice: m.ltp,
        breakoutLevel: null,
        entryLow: null,
        entryHigh: null,
        stopLoss: null,
        target1: null,
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
        warnings: [...score.warnings],
        confidenceScore: null,
    };
    if (m.ltp === null) {
        base.reason = "No last traded price available; cannot build a setup.";
        return base;
    }
    const breakoutLevel = m.prevHighPrice ?? m.highPrice;
    const support = m.prevLowPrice ?? m.lowPrice;
    if (breakoutLevel === null) {
        base.reason = "No resistance/breakout level available (need prior-day high or today's high).";
        base.status = "INSUFFICIENT_DATA";
        return base;
    }
    if (support === null) {
        base.reason = "No support level available (need prior-day low or today's low) for stop loss.";
        base.status = "INSUFFICIENT_DATA";
        return base;
    }
    const currentPrice = m.ltp;
    const dayRangeRatio = m.dayRange && m.dayRange > 0 && currentPrice > 0 ? m.dayRange / currentPrice : 0.015;
    const buffer = clamp(dayRangeRatio * 0.5, 0.003, 0.03);
    const entryLow = round4(breakoutLevel * (1 + buffer));
    const entryHigh = round4(breakoutLevel * (1 + 2 * buffer));
    const stopLoss = round4(support * (1 - buffer));
    if (stopLoss >= entryLow) {
        base.breakoutLevel = breakoutLevel;
        base.entryLow = entryLow;
        base.entryHigh = entryHigh;
        base.stopLoss = stopLoss;
        base.reason = "Technical stop loss would be at or above entry; no valid risk/reward. Avoid.";
        base.status = "AVOID";
        base.warnings.push("Stop loss >= entry zone - invalid setup.");
        return base;
    }
    const riskPerShare = round4(entryLow - stopLoss);
    const minRR = settings.minRiskReward;
    const target1 = round4(entryLow + minRR * riskPerShare);
    const target2 = round4(entryLow + (minRR + 1) * riskPerShare);
    const reward1 = round4(target1 - entryLow);
    const reward2 = round4(target2 - entryLow);
    const rr1 = round2(reward1 / riskPerShare);
    const rr2 = round2(reward2 / riskPerShare);
    // Position sizing
    const maximumRisk = (settings.capital * settings.riskPercent) / 100;
    const qtyByRisk = Math.floor(maximumRisk / riskPerShare);
    const qtyByCapital = Math.floor(settings.capital / entryLow);
    const recommendedQty = Math.max(0, Math.min(qtyByRisk, qtyByCapital));
    const capitalUsed = round2(recommendedQty * entryLow);
    const maximumLoss = round2(recommendedQty * riskPerShare);
    let status;
    let setupType = "BREAKOUT";
    let reason = "";
    if (m.is52wLow || (m.isTopLoser && score.normalizedScore < 60)) {
        status = "AVOID";
        reason = m.is52wLow
            ? "Stock is at a new 52-week low; not a swing long candidate."
            : "Top loser with weak score; avoid long setups.";
    }
    else if (currentPrice > breakoutLevel * (1 + 0.015)) {
        status = "CHASE_RISK";
        setupType = "CHASE_RISK";
        reason =
            "Price is already extended well above the breakout level. Do not chase; wait for a pullback or retest.";
    }
    else if (currentPrice < breakoutLevel) {
        status = "WAIT_FOR_BREAKOUT";
        reason = `Price has not yet broken above the breakout level of ${fmt(breakoutLevel)}. Wait for confirmation.`;
    }
    else {
        // Price is at/above breakout but within reasonable extension
        if (score.normalizedScore >= 70 && rr1 >= minRR) {
            status = "BUY_SETUP";
            reason = `Confirmed breakout with strong score ${score.normalizedScore} and acceptable risk/reward (1:${rr1}).`;
        }
        else if (score.normalizedScore >= 60) {
            status = "WATCH";
            reason = `Breakout confirmed but score ${score.normalizedScore} is moderate. Watch for continuation.`;
        }
        else {
            status = "WATCH";
            reason = `Breakout area but score ${score.normalizedScore} is weak. Watch only.`;
        }
    }
    const triggerCondition = `Enter long only on a confirmed breakout above ${fmt(breakoutLevel)} (sustainable, not a spike). Preferred entry ${fmt(entryLow)}–${fmt(entryHigh)}.`;
    const invalidationCondition = `Invalidate if price closes below ${fmt(stopLoss)}.`;
    const positiveSignals = score.signals.filter((s) => s.points > 0).length;
    const totalSignals = score.signals.length || 1;
    const confidenceRaw = (positiveSignals / totalSignals) * 100 * (rr1 >= minRR ? 1 : 0.6);
    const confidenceScore = round2(clamp(confidenceRaw, 0, 100));
    return {
        ...base,
        setupType,
        status,
        breakoutLevel: round4(breakoutLevel),
        entryLow,
        entryHigh,
        stopLoss,
        target1,
        target2,
        riskPerShare,
        reward1PerShare: reward1,
        reward2PerShare: reward2,
        riskReward1: rr1,
        riskReward2: rr2,
        recommendedQuantity: recommendedQty,
        capitalUsed,
        maximumLoss,
        triggerCondition,
        invalidationCondition,
        reason,
        confidenceScore,
    };
}
//# sourceMappingURL=setup.js.map