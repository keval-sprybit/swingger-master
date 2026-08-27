import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { todayISO, fmtCurrency } from "../utils";
import StatusBadge from "../components/StatusBadge";
import ScoreBadge from "../components/ScoreBadge";
import { Eye } from "lucide-react";

export default function Watchlist() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async (d: string) => {
    setLoading(true);
    try {
      const res = await api.watchlist(d);
      setData(res);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(date); }, [date]);

  const wl = data?.watchlist;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <Eye className="text-emerald-400" size={22} />
          Next Session Watchlist
        </h1>
        <input type="date" value={date} onChange={(e) => { setDate(e.target.value); load(e.target.value); }} className="input" />
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : !wl ? (
        <div className="card text-center text-gray-500 py-8">No analysis available for {date}. Run EOD analysis first.</div>
      ) : wl.items.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-lg font-bold text-yellow-400 mb-2">NO TRADE TODAY</p>
          <p className="text-gray-500 text-sm">No setup satisfies minimum risk/reward and technical confirmation.</p>
        </div>
      ) : (
        <>
          <div className="card">
            <p className="text-sm text-gray-400 mb-1">Trading Date: <strong className="text-gray-100">{wl.tradingDate}</strong></p>
            <p className="text-sm text-gray-400">Next Trading Date: <strong className="text-gray-100">{wl.nextTradingDate ?? "—"}</strong></p>
            <p className="text-xs text-gray-500 mt-2">Analysis Run #{wl.analysisRunId} · {wl.items.length} candidates</p>
          </div>

          <div className="space-y-3">
            {wl.items.map((item: any) => {
              const setup = item.tradeSetup;
              return (
                <div key={item.id} className="card hover:border-emerald-600/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 font-bold">#{item.rank}</span>
                      <Link to={`/candidates/${item.stock.symbol}?date=${date}`} className="text-lg font-bold text-gray-100 hover:text-emerald-400">
                        {item.stock.symbol}
                      </Link>
                      <span className="text-gray-500 text-sm">{item.stock.companyName}</span>
                      {item.score != null && <ScoreBadge score={item.score} classification={setup?.status === "AVOID" ? "D" : "B"} />}
                    </div>
                    <StatusBadge status={item.status} />
                  </div>

                  {item.reason && <p className="text-xs text-gray-500 mb-3 italic">{item.reason}</p>}

                  {setup && setup.status !== "INSUFFICIENT_DATA" && setup.status !== "NO_TRADE" && setup.status !== "AVOID" && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-4 bg-gray-800/50 rounded-lg p-4">
                      <InfoMini label="Current" value={fmtCurrency(setup.currentPrice)} />
                      <InfoMini label="Entry Zone" value={`${fmtCurrency(setup.entryLow)}–${fmtCurrency(setup.entryHigh)}`} />
                      <InfoMini label="Stop Loss" value={fmtCurrency(setup.stopLoss)} neg />
                      <InfoMini label="Target 1" value={fmtCurrency(setup.target1)} pos />
                      <InfoMini label="Target 2" value={fmtCurrency(setup.target2)} pos />
                      <InfoMini label="R:R" value={`1:${Number(setup.riskReward1).toFixed(1) ?? "—"}`} />
                      <InfoMini label="Qty" value={`${setup.recommendedQuantity ?? "—"}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="text-[9px] text-gray-700 text-center mt-8">Watchlist is a screening output. Final trade decisions require independent confirmation and risk management.</p>
    </div>
  );
}

function InfoMini({ label, value, neg, pos }: { label: string; value: string; neg?: boolean; pos?: boolean }) {
  return (
    <div>
      <p className="text-[9px] uppercase text-gray-600 mb-0.5">{label}</p>
      <p className={`text-xs font-bold ${neg ? "text-red-400" : pos ? "text-emerald-400" : "text-gray-200"}`}>{value}</p>
    </div>
  );
}
