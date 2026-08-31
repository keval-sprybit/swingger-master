import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api, type Mode } from "../services/api";
import { todayISO, fmtCurrency } from "../utils";
import StatusBadge from "../components/StatusBadge";
import ScoreBadge from "../components/ScoreBadge";
import ModeToggle from "../components/ModeToggle";
import { Eye } from "lucide-react";

export default function Watchlist() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlMode: Mode = searchParams.get("mode") === "INTRADAY" ? "INTRADAY" : "SWING";
  const urlDate = searchParams.get("date") ?? todayISO();
  const [date, setDate] = useState(urlDate);
  const [mode, setMode] = useState<Mode>(urlMode);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const updateUrl = (newDate?: string, newMode?: Mode) => {
    const params = new URLSearchParams();
    if (newDate) params.set("date", newDate);
    if (newMode) params.set("mode", newMode);
    navigate({ search: params.toString() }, { replace: true });
  };

  const load = async (d: string, m: Mode) => {
    setLoading(true);
    try {
      const res = await api.watchlist(d, m);
      setData(res);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(date, mode); }, [date, mode]);

  const wl = data?.watchlist;
  const runStatus = data?.runStatus;
  const isIntraday = mode === "INTRADAY";
  const title = isIntraday ? "Today's Intraday Watchlist" : "Next Session Watchlist";
  const subtitle = isIntraday ? "Today's intraday analysis" : "Next-session analysis";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <Eye className="text-emerald-400" size={22} />
          {title}
        </h1>
        <div className="flex items-center gap-3">
          <ModeToggle mode={mode} onChange={(m) => { setMode(m); load(date, m); }} />
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); load(e.target.value, mode); }} className="input" />
        </div>
      </div>
      <p className="text-sm text-gray-500 -mt-3">{subtitle}</p>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : runStatus == null ? (
        <div className="card text-center text-gray-500 py-8">
          {isIntraday
            ? `No ${mode} analysis available for ${date}. Run INTRADAY analysis first.`
            : `No analysis available for ${date}. Run ${mode} analysis first.`}
        </div>
      ) : runStatus === "FAILED" ? (
        <div className="card text-center text-red-400 py-8">Intraday analysis failed.</div>
      ) : !wl || wl.items.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-lg font-bold text-yellow-400 mb-2">NO TRADE TODAY</p>
          <p className="text-gray-500 text-sm">
            {isIntraday
              ? "Intraday analysis completed \u2014 no qualifying candidates found."
              : "No setup satisfies minimum risk/reward and technical confirmation."}
          </p>
        </div>
      ) : (
        <>
          <div className="card">
            <p className="text-sm text-gray-400 mb-1">Trading Date: <strong className="text-gray-100">{wl.tradingDate}</strong></p>
            <p className="text-sm text-gray-400">Next Trading Date: <strong className="text-gray-100">{wl.nextTradingDate ?? "—"}</strong></p>
            <p className="text-xs text-gray-500 mt-2">Analysis Run #{wl.analysisRunId} · {wl.items.length} candidates · <span className="text-emerald-400 font-semibold">{mode}</span></p>
          </div>

          <div className="space-y-3">
            {wl.items.map((item: any) => {
              const setup = item.tradeSetup;
              return (
                <div key={item.id} className="card hover:border-emerald-600/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 font-bold">#{item.rank}</span>
                      <Link to={`/candidates/${item.stock.symbol}?date=${date}&mode=${mode}`} className="text-lg font-bold text-gray-100 hover:text-emerald-400">
                        {item.stock.symbol}
                      </Link>
                      <span className="text-gray-500 text-sm">{item.stock.companyName}</span>
                      {item.score != null && <ScoreBadge score={item.score} classification={setup?.status === "AVOID" ? "D" : "B"} />}
                      {setup?.trend && (
                        <span className={`text-xs font-bold uppercase ${setup.trend === "BULLISH" ? "text-emerald-400" : setup.trend === "BEARISH" ? "text-red-400" : "text-gray-400"}`}>
                          {setup.trend}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={item.status} />
                  </div>

                  {item.reason && <p className="text-xs text-gray-500 mb-3 italic">{item.reason}</p>}
                  {setup?.whySelected && setup.whySelected.length > 0 && (
                    <ul className="mb-3 space-y-0.5">
                      {setup.whySelected.map((w: string, i: number) => (
                        <li key={i} className="text-xs text-gray-400 flex items-start gap-2"><span className="text-emerald-400">✓</span>{w}</li>
                      ))}
                    </ul>
                  )}

                  {setup && setup.status !== "INSUFFICIENT_DATA" && setup.status !== "NO_TRADE" && setup.status !== "AVOID" && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-4 bg-gray-800/50 rounded-lg p-4">
                      <InfoMini label="Current" value={fmtCurrency(setup.currentPrice)} />
                      <InfoMini label="Breakout" value={setup.breakoutLevel ? fmtCurrency(setup.breakoutLevel) : "—"} />
                      <InfoMini label="Entry Zone" value={`${fmtCurrency(setup.entryLow)}–${fmtCurrency(setup.entryHigh)}`} />
                      <InfoMini label="Stop Loss" value={fmtCurrency(setup.stopLoss)} neg />
                      <InfoMini label="Target 1" value={fmtCurrency(setup.target1)} pos />
                      <InfoMini label="Target 2" value={fmtCurrency(setup.target2)} pos />
                      <InfoMini label="R:R" value={`1:${Number(setup.riskReward1).toFixed(1) ?? "—"}`} />
                      <InfoMini label="Qty" value={`${setup.recommendedQuantity ?? "—"}`} />
                    </div>
                  )}
                  {setup?.breakoutReason && (
                    <div className="mt-3 p-3 rounded bg-gray-800 text-[11px] text-gray-400">
                      <span className="font-bold text-emerald-400">Breakout: </span>{setup.breakoutReason}
                    </div>
                  )}
                  {setup?.stopLossReason && (
                    <div className="mt-2 p-3 rounded bg-gray-800 text-[11px] text-gray-400">
                      <span className="font-bold text-red-400">Stop: </span>{setup.stopLossReason}
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
