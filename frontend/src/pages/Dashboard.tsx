import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import { todayISO, fmtPct, fmtCurrency, fmtVol } from "../utils";
import ScoreBadge from "../components/ScoreBadge";
import StatusBadge from "../components/StatusBadge";
import { BarChart3, ArrowUpRight, Clock, AlertTriangle, FileCheck, List, Eye } from "lucide-react";

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const urlDate = searchParams.get("date") ?? undefined;
  const urlSnapshot = searchParams.get("snapshot") ? Number(searchParams.get("snapshot")) : undefined;
  const [date, setDate] = useState(urlDate ?? todayISO());
  const [snapshot, setSnapshot] = useState<number | undefined>(urlSnapshot);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (d: string, snap?: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.dashboard(d, snap);
      setData(res);
      if (res.tradingDate) setDate(res.tradingDate);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(date, urlSnapshot); setSnapshot(urlSnapshot); // eslint-disable-line
  }, []);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <BarChart3 className="text-emerald-400" size={24} />
            NSE Swing Analyzer
          </h1>
          <p className="text-gray-500 text-sm mt-1">Analytical decision-support tool. Market returns not guaranteed.</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSnapshot(undefined); load(e.target.value); }} className="input" />
        </div>
      </div>

      {snapshot !== undefined && (
        <div className="card bg-amber-900/10 border-amber-700/30 text-amber-300 text-sm flex items-center gap-2">
          <Clock size={15} />
          Viewing snapshot v{snapshot}
          {data?.sectionSnapshotCreatedAt ? <> · {new Date(data.sectionSnapshotCreatedAt).toLocaleString()}</> : null}.{" "}
          <Link to={date ? `/?date=${date}` : "/"} className="underline hover:text-amber-200">Show latest snapshot</Link>
        </div>
      )}

      {error && <div className="card bg-red-900/20 border-red-700/30 text-red-400 text-sm flex items-center gap-2"><AlertTriangle size={16}/> {error}</div>}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : data ? (
        <>
          {/* Status bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card flex items-center gap-3">
              <Clock size={18} className="text-amber-400" />
              <div>
                <p className="text-[10px] uppercase text-gray-500">Market</p>
                <p className="font-bold text-sm">{data.marketStatus}</p>
              </div>
            </div>
            <div className="card flex items-center gap-3">
              <FileCheck size={18} className="text-emerald-400" />
              <div>
                <p className="text-[10px] uppercase text-gray-500">Reports</p>
                <p className="font-bold text-sm">{data.completeness.received}/{data.completeness.expected}</p>
              </div>
            </div>
            <div className="card flex items-center gap-3">
              <List size={18} className="text-blue-400" />
              <div>
                <p className="text-[10px] uppercase text-gray-500">Analysis</p>
                <p className="font-bold text-sm">{data.analysisStatus ?? "Not run"}</p>
              </div>
            </div>
            <div className="card flex items-center gap-3">
              <Eye size={18} className="text-purple-400" />
              <div>
                <p className="text-[10px] uppercase text-gray-500">Next Session</p>
                <p className="font-bold text-sm">{data.nextTradingDate ?? "—"}</p>
              </div>
            </div>
          </div>

          {/* Top Candidates */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-100">Top Candidates</h2>
              <Link to="/candidates" className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1">
                View all <ArrowUpRight size={14} />
              </Link>
            </div>
            {data.topCandidates.length === 0 ? (
              <div className="card text-center text-gray-500">No analysis available. Upload CSVs and run EOD analysis.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-[10px] uppercase tracking-wider border-b border-gray-800">
                      <th className="pb-2 pr-4">#</th>
                      <th className="pb-2 pr-4">Symbol</th>
                      <th className="pb-2 pr-4">Score</th>
                      <th className="pb-2 pr-4">Classification</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4 text-right">LTP</th>
                      <th className="pb-2 text-right">Signals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCandidates.slice(0, 15).map((c: any, i: number) => (
                      <tr key={c.symbol} className="table-row">
                        <td className="py-2.5 pr-4 text-gray-500">{i + 1}</td>
                        <td className="py-2.5 pr-4">
                          <Link to={`/candidates/${c.symbol}`} className="font-semibold text-gray-100 hover:text-emerald-400 transition-colors">
                            {c.symbol}
                          </Link>
                          <span className="text-gray-500 text-xs ml-2">{c.company}</span>
                        </td>
                        <td className="py-2.5 pr-4"><ScoreBadge score={c.score} classification={c.classification} /></td>
                        <td className="py-2.5 pr-4 text-xs text-gray-400">{c.classification?.replace("_", "+")}</td>
                        <td className="py-2.5 pr-4"><StatusBadge status={c.status} /></td>
                        <td className="py-2.5 pr-4 text-right font-mono">{fmtCurrency(c.ltp)}</td>
                        <td className="py-2.5 text-right text-xs text-gray-400">
                          {(c.signals ?? []).filter((s: any) => s.points > 0).length} signals
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Report sections — all 8 supported reports in a 2-column grid */}
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-lg font-bold text-gray-100">Market Snapshot</h2>
              {snapshot !== undefined ? (
                <span className="text-xs text-amber-300 bg-amber-900/20 px-2.5 py-1 rounded-full border border-amber-500/30">
                  Snapshot v{snapshot}
                  {data?.sectionSnapshotCreatedAt ? ` · ${new Date(data.sectionSnapshotCreatedAt).toLocaleString()}` : ""}
                </span>
              ) : (
                <span className="text-xs text-emerald-400 bg-emerald-900/20 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  Showing latest {data?.sectionAnalysisType ?? "INTRADAY"} snapshot
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Section title="Most Active by Volume" items={data.sections.mostActiveVolume} dataKey="mostActiveVolume"
                columns={[
                  { key: "symbol", label: "Symbol", fmt: (v: any) => v, bold: true },
                  { key: "ltp", label: "LTP", fmt: fmtCurrency },
                  { key: "changePercent", label: "Chg%", fmt: fmtPct, colored: true },
                  { key: "volume", label: "Volume", fmt: fmtVol },
                  { key: "turnover", label: "Turnover", fmt: fmtVol },
                ]} />
              <Section title="Most Active by Value" items={data.sections.mostActiveValue} dataKey="mostActiveValue"
                columns={[
                  { key: "symbol", label: "Symbol", fmt: (v: any) => v, bold: true },
                  { key: "ltp", label: "LTP", fmt: fmtCurrency },
                  { key: "changePercent", label: "Chg%", fmt: fmtPct, colored: true },
                  { key: "volume", label: "Volume", fmt: fmtVol },
                  { key: "turnover", label: "Turnover", fmt: fmtVol },
                ]} />
              <Section title="Volume Gainers" items={data.sections.volumeGainers} dataKey="volumeGainers"
                columns={[
                  { key: "symbol", label: "Symbol", fmt: (v: any) => v, bold: true },
                  { key: "todayLtp", label: "LTP", fmt: fmtCurrency },
                  { key: "todayChangePercent", label: "Chg%", fmt: fmtPct, colored: true },
                  { key: "volumeRatio1w", label: "Ratio 1w", fmt: (v: any) => (v !== null && v !== undefined && !isNaN(v) ? Number(v).toFixed(1) + "x" : "—") },
                  { key: "todayVolume", label: "Volume", fmt: fmtVol },
                ]} />
              <Section title="New 52 Week High" items={data.sections.week52High} dataKey="week52High"
                columns={[
                  { key: "symbol", label: "Symbol", fmt: (v: any) => v, bold: true },
                  { key: "ltp", label: "LTP", fmt: fmtCurrency },
                  { key: "changePercent", label: "Chg%", fmt: fmtPct, colored: true },
                  { key: "new52wHigh", label: "52W High", fmt: fmtCurrency },
                ]} />
              <Section title="New 52 Week Low" items={data.sections.week52Low} dataKey="week52Low"
                columns={[
                  { key: "symbol", label: "Symbol", fmt: (v: any) => v, bold: true },
                  { key: "ltp", label: "LTP", fmt: fmtCurrency },
                  { key: "changePercent", label: "Chg%", fmt: fmtPct, colored: true },
                  { key: "new52wLow", label: "52W Low", fmt: fmtCurrency },
                ]} />
              <Section title="Top 20 Gainers" items={data.sections.topGainers} dataKey="topGainers"
                columns={[
                  { key: "symbol", label: "Symbol", fmt: (v: any) => v, bold: true },
                  { key: "ltp", label: "LTP", fmt: fmtCurrency },
                  { key: "changePercent", label: "Chg%", fmt: fmtPct, colored: true },
                  { key: "volume", label: "Volume", fmt: fmtVol },
                ]} />
              <Section title="Top 20 Losers" items={data.sections.topLosers} dataKey="topLosers"
                columns={[
                  { key: "symbol", label: "Symbol", fmt: (v: any) => v, bold: true },
                  { key: "ltp", label: "LTP", fmt: fmtCurrency },
                  { key: "changePercent", label: "Chg%", fmt: fmtPct, colored: true },
                  { key: "volume", label: "Volume", fmt: fmtVol },
                ]} />
              <Section title="Large Deals / Bulk Deals" items={data.sections.largeDeals} dataKey="largeDeals"
                columns={[
                  { key: "symbol", label: "Symbol", fmt: (v: any) => v, bold: true },
                  { key: "buySell", label: "Side", fmt: (v: any) => (v ? String(v).toUpperCase() : "—"), sideBadge: true },
                  { key: "quantityTraded", label: "Qty", fmt: (v: any) => (v !== null && v !== undefined ? Number(v).toLocaleString("en-IN") : "—") },
                  { key: "tradePrice", label: "Price", fmt: fmtCurrency },
                ]} />
            </div>
          </section>

          {/* Watchlist summary */}
          {data.watchlist && data.watchlist.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-100">Next Session Watchlist</h2>
                <Link to="/watchlist" className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1">
                  Full watchlist <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.watchlist.map((w: any) => (
                  <Link key={w.rank} to={`/candidates/${w.symbol}`} className="card hover:border-emerald-600/50 transition-colors group">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-gray-500 text-xs">#{w.rank}</span>
                        <span className="font-bold text-gray-100 ml-2 group-hover:text-emerald-400">{w.symbol}</span>
                      </div>
                      <StatusBadge status={w.status} />
                    </div>
                    {w.setup && (
                      <div className="mt-3 space-y-1 text-xs">
                        <div className="flex justify-between text-gray-400"><span>Entry</span><span>{fmtCurrency(w.setup.entryLow)}–{fmtCurrency(w.setup.entryHigh)}</span></div>
                        <div className="flex justify-between text-gray-400"><span>Stop</span><span className="text-red-400">{fmtCurrency(w.setup.stopLoss)}</span></div>
                        <div className="flex justify-between text-gray-400"><span>Target 1</span><span className="text-emerald-400">{fmtCurrency(w.setup.target1)}</span></div>
                        <div className="flex justify-between text-gray-400"><span>R:R</span><span>1:{Number(w.setup.riskReward1).toFixed(1) ?? "—"}</span></div>
                        <div className="flex justify-between text-gray-400"><span>Qty</span><span>{w.setup.recommendedQuantity ?? "—"}</span></div>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.sections.noTrade && (
            <div className="card bg-gray-800/50 border-yellow-600/20 text-center py-8">
              <p className="text-lg font-bold text-yellow-400 mb-2">NO TRADE TODAY</p>
              <p className="text-gray-500 text-sm">No setup satisfies minimum risk/reward and technical confirmation.</p>
            </div>
          )}
        </>
      ) : (
        <div className="card text-center text-gray-500 py-12">No data. Upload NSE CSVs to begin.</div>
      )}

      <p className="text-[9px] text-gray-700 text-center mt-8">NSE Swing Analyzer is an analytical decision-support tool. High score is not a guarantee of profit. Trade setups are conditional and require independent confirmation.</p>
    </div>
  );
}

function Section({
  title,
  items,
  dataKey,
  columns,
}: {
  title: string;
  items: any[];
  dataKey: string;
  columns: { key: string; label: string; fmt: (v: any) => string; bold?: boolean; colored?: boolean; sideBadge?: boolean }[];
}) {
  const data = Array.isArray(items) ? items : [];
  const symbol = (item: any) => item.symbol || item.stock?.symbol || "";
  const toHref = (sym: string) => (sym ? `/candidates/${encodeURIComponent(sym)}` : null);

  return (
    <div className="card flex flex-col min-h-[200px]">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">{title}</h3>
      {data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-gray-600 text-sm py-8">No data available for this snapshot.</div>
      ) : (
        <div className="max-h-64 overflow-y-auto -mr-2 pr-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="text-left text-[9px] uppercase tracking-wider text-gray-600 border-b border-gray-800">
                {columns.map((c) => (
                  <th key={c.key} className="pb-1.5 pr-2 whitespace-nowrap">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item: any, i: number) => {
                const sym = symbol(item);
                const href = toHref(sym);
                return (
                  <tr key={i} className="border-b border-gray-800/40 last:border-0">
                    {columns.map((c, ci) => {
                      const val = item[c.key];
                      let cell: ReactNode;
                      if (c.key === "symbol") {
                        const symCell = sym || "—";
                        cell = href ? <Link to={href} className="font-semibold text-gray-100 hover:text-emerald-400 transition-colors whitespace-nowrap">{symCell}</Link> : <span className="font-semibold text-gray-100">{symCell}</span>;
                      } else if (c.sideBadge) {
                        const buy = String(val ?? "").toUpperCase() === "BUY";
                        const sell = String(val ?? "").toUpperCase() === "SELL";
                        cell = (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${buy ? "bg-emerald-600/20 text-emerald-400" : sell ? "bg-red-600/20 text-red-400" : "bg-gray-700/30 text-gray-400"}`}>
                            {c.fmt(val)}
                          </span>
                        );
                      } else if (c.colored && val !== null && val !== undefined && !isNaN(Number(val))) {
                        cell = <span className={Number(val) >= 0 ? "text-emerald-400" : "text-red-400"}>{c.fmt(val)}</span>;
                      } else {
                        cell = <span className="text-gray-400">{c.fmt(val)}</span>;
                      }
                      return (
                        <td key={ci} className={`py-1.5 pr-2 whitespace-nowrap ${c.bold ? "" : "text-right"}`}>
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
