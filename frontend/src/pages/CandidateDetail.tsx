import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../services/api";
import { todayISO, fmt, fmtPct, fmtCurrency, fmtVol } from "../utils";
import ScoreBadge from "../components/ScoreBadge";
import StatusBadge from "../components/StatusBadge";
import { ArrowLeft, TrendingUp, AlertTriangle } from "lucide-react";

export default function CandidateDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    api.candidateDetail(symbol, date).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [symbol, date]);

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;
  if (!data) return <div className="text-center py-8 text-gray-500">Stock not found.</div>;

  const { stock, metric, score, setup, sources } = data;
  const signals: any[] = score?.signals ?? [];

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
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Info label="LTP" value={fmtCurrency(setup?.currentPrice ?? metric?.ltp)} />
        <Info label="Change" value={fmtPct(metric?.changePercent)} highlight={metric?.changePercent > 0 ? "pos" : metric?.changePercent < 0 ? "neg" : undefined} />
        <Info label="Volume" value={metric?.volume ? Number(metric.volume).toLocaleString() : "—"} />
        <Info label="Turnover" value={fmtVol(metric?.turnover)} />
        <Info label="Source Count" value={`${metric?.sourceCount ?? 0}`} />
        <Info label="Rank" value={score?.rank ? `#${score.rank}` : "—"} />
      </div>

      {/* Score */}
      {score && (
        <section className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-100">Score</h2>
            <ScoreBadge score={score.normalizedScore} classification={score.classification} />
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
            <StatusBadge status={setup.status} />
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
