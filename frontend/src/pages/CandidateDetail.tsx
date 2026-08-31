import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Mode } from "../services/api";
import { todayISO, fmt, fmtPct, fmtCurrency, fmtVol } from "../utils";
import ScoreBadge from "../components/ScoreBadge";
import StatusBadge from "../components/StatusBadge";
import ModeToggle from "../components/ModeToggle";
import PriceChart, { VolumeChart, ChartLegend } from "../components/PriceChart";
import { ArrowLeft, TrendingUp, AlertTriangle, TrendingDown, Layers, BarChart3 } from "lucide-react";

export default function CandidateDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<Mode>("SWING");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chart, setChart] = useState<any>(null);
  const [chartRange, setChartRange] = useState<"3M" | "6M" | "MAX">("6M");

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    api.candidateDetail(symbol, date, mode).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [symbol, date, mode]);

  useEffect(() => {
    if (!symbol) return;
    api.stockChart(symbol, mode, chartRange).then(setChart).catch(() => setChart(null));
  }, [symbol, mode, chartRange]);

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;
  if (!data) return <div className="text-center py-8 text-gray-500">Stock not found.</div>;

  const { stock, metric, score, setup, sources, priceBars } = data;
  const signals: any[] = score?.signals ?? [];
  const technical = setup?.technicalContext;
  const breakdown: any[] = Array.isArray(setup?.explainableJson) ? setup.explainableJson : [];

  function renderChart() {
    if (!chart) {
      return (
        <section className="card">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="text-emerald-400" size={18} />
            <h2 className="text-lg font-bold text-gray-100">Price Chart</h2>
          </div>
          <p className="text-sm text-gray-500">Loading chart data…</p>
        </section>
      );
    }

    const bars: any[] = (chart.bars ?? []).map((b: any) => ({
      date: (b.tradingDate || "").slice(0, 10),
      o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume,
      sma20: b.sma20, sma50: b.sma50, sma200: b.sma200,
    }));
    const lines = [
      { label: "20 DMA", key: "sma20" as const, color: "#818cf8" },
      { label: "50 DMA", key: "sma50" as const, color: "#38bdf8" },
      { label: "200 DMA", key: "sma200" as const, color: "#fbbf24" },
    ].filter((l) => {
      const val = chart.indicators?.[l.key];
      return val != null;
    });

    const hasSomeBars = bars.length > 0;
    const has20 = chart.indicators?.sma20 != null;
    const has50 = chart.indicators?.sma50 != null;
    const has200 = chart.indicators?.sma200 != null;
    const insuff20 = hasSomeBars && bars.length < 20;
    const insuff50 = hasSomeBars && bars.length < 50;
    const insuff200 = hasSomeBars && bars.length < 200;

    const L = chart.levels ?? {};
    const hlines = [
      { key: "stop", label: "Stop", value: L.stopLoss, color: "#f87171", dash: "6 3" },
      { key: "breakout", label: "Breakout", value: L.breakout, color: "#fbbf24", dash: "4 4" },
      { key: "t1", label: "Target 1", value: L.target1, color: "#34d399", dash: "2 2" },
      { key: "t2", label: "Target 2", value: L.target2, color: "#10b981", dash: "2 4" },
    ].filter((h) => h.value != null);
    const hareas = [
      { key: "entry", label: "Entry Zone", low: L.entryLow, high: L.entryHigh, color: "#22d3ee" },
    ];

    const status = chart.status;
    const breakoutStatus = chart.breakoutStatus;

    // Breakout visualization: make the current-price/breakout relationship obvious.
    let breakoutBanner: { text: string; color: string } | null = null;
    const cp = L.currentPrice;
    const bo = L.breakout;
    if (status === "BREAKOUT_CONFIRMED" || breakoutStatus?.includes("CONFIRMED")) {
      breakoutBanner = { text: "BREAKOUT CONFIRMED — price above breakout with confirmation", color: "text-emerald-300 bg-emerald-900/20 border-emerald-500/30" };
    } else if (status === "BREAKOUT_FAILED" || breakoutStatus?.includes("FAILED")) {
      breakoutBanner = { text: "BREAKOUT FAILED — price crossed above but fell back", color: "text-red-300 bg-red-900/20 border-red-500/30" };
    } else if (status === "MISSED") {
      breakoutBanner = { text: "MISSED — DO NOT CHASE (price too far beyond valid entry)", color: "text-yellow-300 bg-yellow-900/20 border-yellow-500/30" };
    } else if (cp != null && bo != null && cp < bo) {
      breakoutBanner = { text: `WAIT BREAKOUT — current ₹${fmt(cp)} below breakout ₹${fmt(bo)} — not confirmed`, color: "text-amber-300 bg-amber-900/20 border-amber-500/30" };
    }

    return (
      <section className="card">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-emerald-400" size={18} />
            <h2 className="text-lg font-bold text-gray-100">Price Chart</h2>
            <span className="flex items-center gap-2 text-[10px] text-gray-500 ml-2">
              {chart.tradingDate ? <>Trading Date: <b className="text-gray-300">{chart.tradingDate}</b></> : null}
              <span className="text-gray-600">|</span>
              Data: <b className={chart.dataType === "INTRADAY" ? "text-sky-300" : "text-emerald-300"}>{chart.dataType}</b>
              {!chart.intradayAvailable && chart.dataType === "INTRADAY" ? (
                <span className="text-red-400"> (Intraday candle data unavailable)</span>
              ) : null}
              {!chart.intradayAvailable && <span className="text-gray-600">(daily EOD)</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(["3M", "6M", "MAX"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${chartRange === r ? "bg-emerald-600/30 text-emerald-300" : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Intraday caveat: no candle-by-candle intraday data */}
        {mode === "INTRADAY" && (
          <p className="mb-3 rounded border border-sky-700/30 bg-sky-900/10 px-3 py-2 text-xs text-sky-300">
            Today's analysis runs against intraday report snapshots. The application stores daily EOD
            price bars, not candle-by-candle intraday data, so the chart below shows the daily candles
            for price context. "Intraday candle chart unavailable — only snapshot data is available."
          </p>
        )}

        {breakoutBanner && (
          <div className={`mb-3 rounded border px-3 py-2 text-xs font-bold ${breakoutBanner.color}`}>
            {breakoutBanner.text}
          </div>
        )}

        {!hasSomeBars ? (
          <p className="py-6 text-center text-sm text-gray-500">
            Price chart unavailable — historical OHLC data not available.
          </p>
        ) : (
          <>
            <PriceChart
              data={bars}
              lines={lines}
              hlines={hlines}
              hareas={hareas}
              height={380}
            />
            <div className="mt-3">
              <p className="mb-1 text-[10px] uppercase text-gray-500">Volume</p>
              <VolumeChart data={bars} />
            </div>
            <div className="mt-3 border-t border-gray-800 pt-2 flex flex-wrap justify-between gap-2">
              <ChartLegend lines={lines} hlines={hlines} hareas={hareas} />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400">
                {!has20 && <span>20 DMA: <b className="text-red-400">Insufficient data{insuff20 ? ` (${bars.length} bars)` : ""}</b></span>}
                {!has50 && <span>50 DMA: <b className="text-red-400">Insufficient data{insuff50 ? ` (${bars.length} bars)` : ""}</b></span>}
                {!has200 && <span>200 DMA: <b className="text-red-400">Insufficient data{insuff200 ? ` (${bars.length} bars)` : ""}</b></span>}
                {chart.indicators?.rsi14 != null && <span>RSI(14): <b className="text-gray-200">{fmt(chart.indicators.rsi14, 1)}</b></span>}
                {chart.indicators?.atr14 != null && <span>ATR(14): <b className="text-gray-200">{fmtCurrency(chart.indicators.atr14)}</b></span>}
                {chart.indicators?.relVolume != null && <span>Rel Volume: <b className="text-gray-200">{Number(chart.indicators.relVolume).toFixed(1)}x</b></span>}
                {L.riskReward1 != null && <span>R:R: <b className="text-gray-200">1:{Number(L.riskReward1).toFixed(1)}</b></span>}
                {chart.indicators?.trend && <span>Trend: <b className="text-gray-200">{chart.indicators.trend}</b></span>}
                {chart.indicators?.support != null && <span>Support: <b className="text-gray-200">{fmtCurrency(chart.indicators.support)}</b></span>}
                {chart.indicators?.resistance != null && <span>Resistance: <b className="text-gray-200">{fmtCurrency(chart.indicators.resistance)}</b></span>}
              </div>
            </div>
            {chart.availableDays > 0 && (
              <p className="mt-2 text-[10px] text-gray-600">{chart.availableDays} trading session(s) of daily price data available.</p>
            )}
          </>
        )}
      </section>
    );
  }


  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/candidates" className="text-gray-500 hover:text-gray-300"><ArrowLeft size={20} /></Link>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <TrendingUp className="text-emerald-400" size={22} />
            {symbol}
            <span className="text-gray-500 text-base font-normal">{stock?.companyName}</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <ModeToggle mode={setup?.mode === "INTRADAY" ? "INTRADAY" : mode} onChange={setMode} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </div>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Info label="LTP" value={fmtCurrency(setup?.currentPrice ?? metric?.ltp)} />
        <Info label="Change" value={fmtPct(metric?.changePercent)} highlight={metric?.changePercent > 0 ? "pos" : metric?.changePercent < 0 ? "neg" : undefined} />
        <Info label="Volume" value={metric?.volume ? Number(metric.volume).toLocaleString() : "—"} />
        <Info label="Turnover" value={fmtVol(metric?.turnover)} />
        <Info label="Source Count" value={`${metric?.sourceCount ?? 0}`} />
        <Info label="Rank" value={score?.rank ? `#${score.rank}` : "—"} />
        <Info label="Mode" value={setup?.mode ?? (mode as string)} />
      </div>

      {/* Price chart */}
      {renderChart()}

      {/* Why selected + market + trend banner */}
      {setup && (setup.whySelected?.length > 0 || setup.marketCondition || setup.trend) && (
        <section className="card">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {setup.trend && (
              <span className={`flex items-center gap-1.5 font-bold uppercase ${setup.trend === "BULLISH" ? "text-emerald-400" : setup.trend === "BEARISH" ? "text-red-400" : "text-amber-400"}`}>
                {setup.trend === "BULLISH" ? <TrendingUp size={15} /> : setup.trend === "BEARISH" ? <TrendingDown size={15} /> : <Layers size={15} />}
                Trend: {setup.trend}
              </span>
            )}
            {setup.marketCondition && (
              <span className="text-xs text-gray-400">Market: <strong className="text-gray-200">{setup.marketCondition}</strong></span>
            )}
            {setup.explainableScore != null && (
              <span className="text-xs text-gray-400">Explainable Score: <strong className="text-emerald-400">{Number(setup.explainableScore).toFixed(1)}</strong></span>
            )}
          </div>
          {setup.whySelected && setup.whySelected.length > 0 && (
            <ul className="mt-3 space-y-1">
              {setup.whySelected.map((w: string, i: number) => (
                <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✓</span> {w}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Score + Explainable breakdown */}
      {score && (
        <section className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-100">Score</h2>
            <div className="flex items-center gap-3">
              {setup?.explainableScore != null && <ScoreBadge score={setup.explainableScore} classification={score.classification} />}
              <span className="text-gray-600 text-xs">legacy</span>
              <ScoreBadge score={score.normalizedScore} classification={score.classification} />
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {[
              { label: "Most Active Vol", value: score.activityVolumeScore, max: 10 },
              { label: "Most Active Val", value: score.activityValueScore, max: 10 },
              { label: "Volume Expansion", value: score.volumeExpansionScore, max: 20 },
              { label: "Momentum", value: score.momentumScore, max: 10 },
              { label: "52W Status", value: score.week52Score, max: 20 },
              { label: "Top Gainer", value: score.gainerScore, max: 8 },
              { label: "Top Loser", value: score.loserScore, max: 0 },
              { label: "Liquidity", value: score.liquidityScore, max: 8 },
              { label: "Large Deal", value: score.largeDealScore, max: 5 },
              { label: "Price Action", value: score.priceActionScore, max: 5 },
              { label: "Risk Penalty", value: -score.riskPenalty, max: 0 },
            ].map((item) => (
              <div key={item.label} className="bg-gray-800 rounded-lg p-3">
                <p className="text-[10px] uppercase text-gray-500 mb-1">{item.label}</p>
                <p className={`text-lg font-bold ${item.value >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {typeof item.value === "number" && item.value >= 0 ? "+" : ""}{typeof item.value === "number" ? (Number(item.value) % 1 === 0 ? item.value : Number(item.value).toFixed(2)) : item.value}
                </p>
              </div>
            ))}
          </div>

          {breakdown.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] uppercase text-gray-500 mb-2">Explanability breakdown</p>
              <div className="space-y-1.5">
                {breakdown.map((b: any, i: number) => {
                  const pct = Number(b.weight ?? 0) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="w-40 text-gray-400 flex-1">{b.key ?? b.label ?? "component"}</span>
                      <div className="h-1.5 flex-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full ${Number(b.value ?? 0) >= 0 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, Math.abs(pct))}%` }} />
                      </div>
                      <span className="w-14 text-right font-mono text-gray-300">{Number(b.value ?? 0).toFixed(1)}</span>
                      <span className="w-14 text-right font-mono text-gray-600">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {setup?.explainableJson?.components && !Array.isArray(setup.explainableJson) && (
            <div className="mt-4">
              <p className="text-[10px] uppercase text-gray-500 mb-2">Explanability breakdown</p>
              <div className="space-y-1.5">
                {Object.entries(setup.explainableJson.components).map(([k, v]: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{k}</span>
                    <span className="font-mono text-gray-300">{Number(v ?? 0).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signals */}
          <div className="mt-4 space-y-1.5">
            {signals.map((s: any, i: number) => (
              <div key={i} className={`flex items-center gap-3 text-xs py-1.5 px-3 rounded ${s.points > 0 ? "bg-emerald-900/20 text-emerald-300" : s.points < 0 ? "bg-red-900/20 text-red-300" : "text-gray-500"}`}>
                <span className="font-bold w-8">{s.points > 0 ? "+" : ""}{s.points}</span>
                <span className="flex-1">{s.label}</span>
                <span className="text-gray-500">Source: {s.source}</span>
              </div>
            ))}
          </div>

          {score.warnings && score.warnings.length > 0 && (
            <div className="mt-4 space-y-1">
              {score.warnings.map((w: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/20 px-3 py-1.5 rounded">
                  <AlertTriangle size={12} /> {w}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Trade Setup */}
      {setup && (
        <section className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-100">Trade Setup</h2>
            <div className="flex items-center gap-3">
              {setup.breakoutStatus && <span className="text-xs text-gray-500">{setup.breakoutStatus}</span>}
              <StatusBadge status={setup.status} />
            </div>
          </div>
          {(setup.status === "INSUFFICIENT_DATA" || setup.status === "NO_TRADE" || setup.status === "AVOID") ? (
            <p className="text-gray-400 text-sm">{setup.reason ?? "No trade setup available."}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <Info label="Current Price" value={fmtCurrency(setup.currentPrice)} />
              <Info label="Breakout Level" value={fmtCurrency(setup.breakoutLevel)} />
              <Info label="Entry Zone" value={`${fmtCurrency(setup.entryLow)} — ${fmtCurrency(setup.entryHigh)}`} />
              <Info label="Stop Loss" value={fmtCurrency(setup.stopLoss)} highlight="neg" />
              <Info label="Target 1" value={fmtCurrency(setup.target1)} highlight="pos" />
              <Info label="Target 2" value={fmtCurrency(setup.target2)} highlight="pos" />
              <Info label="Risk/Share" value={fmtCurrency(setup.riskPerShare)} />
              <Info label="R:R (T1)" value={`1:${Number(setup.riskReward1).toFixed(1)}`} />
              <Info label="R:R (T2)" value={`1:${Number(setup.riskReward2).toFixed(1)}`} />
              <Info label="Capital" value={fmtCurrency(setup.capitalAvailable)} />
              <Info label="Risk %" value={`${setup.riskPercent}%`} />
              <Info label="Max Risk" value={fmtCurrency(setup.maximumRisk)} />
              <Info label="Qty" value={`${setup.recommendedQuantity ?? 0}`} />
              <Info label="Capital Used" value={fmtCurrency(setup.capitalUsed)} />
              <Info label="Max Loss" value={fmtCurrency(setup.maximumLoss)} highlight="neg" />
              <Info label="Confidence" value={`${setup.confidenceScore ?? 0}%`} />
            </div>
          )}
          {setup.breakoutReason && (
            <div className="mt-3 p-3 rounded bg-gray-800 text-xs text-gray-400">
              <p className="font-bold text-emerald-400 mb-1">Why this breakout level:</p>
              <p>{setup.breakoutReason}</p>
            </div>
          )}
          {setup.stopLossReason && (
            <div className="mt-2 p-3 rounded bg-gray-800 text-xs text-gray-400">
              <p className="font-bold text-red-400 mb-1">Why this stop loss:</p>
              <p>{setup.stopLossReason}</p>
            </div>
          )}
          {(setup.target1Reason || setup.target2Reason) && (
            <div className="mt-2 p-3 rounded bg-gray-800 text-xs text-gray-400">
              <p className="font-bold text-emerald-400 mb-1">Why these targets:</p>
              <p>{setup.target1Reason}{setup.target1Reason && setup.target2Reason ? " " : ""}{setup.target2Reason ?? ""}</p>
            </div>
          )}
          {setup.trendReasons && setup.trendReasons.length > 0 && (
            <div className="mt-2 p-3 rounded bg-gray-800 text-xs text-gray-400">
              <p className="font-bold text-gray-300 mb-1">Why this trend:</p>
              <ul className="space-y-0.5">
                {setup.trendReasons.map((t: string, i: number) => <li key={i} className="flex items-start gap-2"><span className="text-gray-600">•</span>{t}</li>)}
              </ul>
            </div>
          )}
          {setup.technicalContext && (
            <div className="mt-2 p-3 rounded bg-gray-800/50 text-xs text-gray-400">
              <p className="font-bold text-gray-300 mb-1">Technical context:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {technical && (
                  <>
                    <Til label="RSI (14)" value={fmt(technical.rsi14)} />
                    <Til label="ATR (14)" value={fmtCurrency(technical.atr14)} />
                    <Til label="SMA 20" value={fmtCurrency(technical.sma20)} />
                    <Til label="SMA 50" value={fmtCurrency(technical.sma50)} />
                    <Til label="SMA 200" value={fmtCurrency(technical.sma200)} />
                    <Til label="Rel Volume" value={technical.relativeVolume != null ? `${Number(technical.relativeVolume).toFixed(1)}x` : "—"} />
                    <Til label="Ret 1d" value={fmtPct(technical.return1d)} />
                    <Til label="Ret 5d" value={fmtPct(technical.return5d)} />
                    <Til label="Ret 10d" value={fmtPct(technical.return10d)} />
                    <Til label="Ret 20d" value={fmtPct(technical.return20d)} />
                    <Til label="Support" value={fmtCurrency(technical.support)} />
                    <Til label="Resistance" value={fmtCurrency(technical.resistance)} />
                  </>
                )}
              </div>
            </div>
          )}
          {setup.triggerCondition && (
            <div className="mt-4 p-3 rounded bg-gray-800 text-xs text-gray-400">
              <p className="font-bold text-gray-300 mb-1">Trigger:</p>
              <p>{setup.triggerCondition}</p>
            </div>
          )}
          {setup.invalidationCondition && (
            <div className="mt-2 p-3 rounded bg-gray-800 text-xs text-gray-400">
              <p className="font-bold text-gray-300 mb-1">Invalidation:</p>
              <p>{setup.invalidationCondition}</p>
            </div>
          )}
          {setup.reason && (
            <div className="mt-3 p-3 rounded bg-gray-800/50 text-xs text-gray-400">
              <p className="font-bold text-gray-300 mb-1">Reason:</p>
              <p>{setup.reason}</p>
            </div>
          )}
        </section>
      )}

      {/* Price history (bhavcopy) */}
      {priceBars && priceBars.length > 0 && (
        <section className="card">
          <h2 className="text-lg font-bold text-gray-100 mb-3">Price History <span className="text-gray-500 text-xs font-normal">(last {priceBars.length} sessions)</span></h2>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="text-left text-[9px] uppercase tracking-wider text-gray-600 border-b border-gray-800">
                  <th className="pb-1.5 pr-3">Date</th>
                  <th className="pb-1.5 pr-3 text-right">Open</th>
                  <th className="pb-1.5 pr-3 text-right">High</th>
                  <th className="pb-1.5 pr-3 text-right">Low</th>
                  <th className="pb-1.5 pr-3 text-right">Close</th>
                  <th className="pb-1.5 text-right">Volume</th>
                </tr>
              </thead>
              <tbody>
                {priceBars.map((b: any, i: number) => (
                  <tr key={i} className="border-b border-gray-800/40 last:border-0">
                    <td className="py-1 pr-3 text-gray-500">{b.tradingDate?.slice(0, 10)}</td>
                    <td className="py-1 pr-3 text-right font-mono">{fmtCurrency(b.openPrice)}</td>
                    <td className="py-1 pr-3 text-right font-mono text-emerald-400">{fmtCurrency(b.highPrice)}</td>
                    <td className="py-1 pr-3 text-right font-mono text-red-400">{fmtCurrency(b.lowPrice)}</td>
                    <td className="py-1 pr-3 text-right font-mono">{fmtCurrency(b.closePrice)}</td>
                    <td className="py-1 text-right font-mono text-gray-400">{b.tradedQty != null ? Number(b.tradedQty).toLocaleString("en-IN") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Source Records */}
      <section className="card">
        <h2 className="text-lg font-bold text-gray-100 mb-3">Source Records</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: "Most Active by Volume", data: sources.mostActiveVolume },
            { name: "Most Active by Value", data: sources.mostActiveValue },
            { name: "Volume Gainers", data: sources.volumeGainer },
            { name: "52 Week High", data: sources.week52High },
            { name: "52 Week Low", data: sources.week52Low },
            { name: "Top Gainer", data: sources.topGainer },
            { name: "Top Loser", data: sources.topLoser },
          ].map(({ name, data: d }) => (
            <div key={name} className={`p-3 rounded border ${d ? "border-emerald-700/30 bg-emerald-900/10" : "border-gray-800 bg-gray-800/30"}`}>
              <p className="text-xs font-bold text-gray-500 mb-1">{d ? "✓" : "—"} {name}</p>
              {d && (
                <div className="text-xs text-gray-400 space-y-0.5">
                  {d.ltp && <p>LTP: {fmtCurrency(d.ltp)}</p>}
                  {d.volume && <p>Volume: {Number(d.volume).toLocaleString()}</p>}
                  {d.turnover && <p>Turnover: {fmtVol(d.turnover)}</p>}
                  {d.changePercent && <p>Chg: {fmtPct(d.changePercent)}</p>}
                </div>
              )}
            </div>
          ))}
          {sources.largeDeals && sources.largeDeals.length > 0 && (
            <div className="p-3 rounded border border-emerald-700/30 bg-emerald-900/10">
              <p className="text-xs font-bold text-gray-500 mb-1">✓ Bulk Deals ({sources.largeDeals.length})</p>
              <div className="text-xs text-gray-400 space-y-0.5 max-h-24 overflow-y-auto">
                {sources.largeDeals.map((deal: any, i: number) => (
                  <p key={i}>{deal.buySell} {Number(deal.quantityTraded).toLocaleString()} @ {fmtCurrency(deal.tradePrice)} — {deal.clientName}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <Link to={`/history/${symbol}`} className="text-emerald-400 hover:text-emerald-300 text-sm">View historical scores →</Link>
    </div>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: "pos" | "neg" }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-gray-500 mb-0.5">{label}</p>
      <p className={`font-bold text-sm ${
        highlight === "pos" ? "text-emerald-400" : highlight === "neg" ? "text-red-400" : "text-gray-100"
      }`}>{value}</p>
    </div>
  );
}

function Til({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase text-gray-600 mb-0.5">{label}</p>
      <p className="font-mono text-xs text-gray-200">{value}</p>
    </div>
  );
}
