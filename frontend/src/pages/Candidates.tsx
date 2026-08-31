import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type Mode } from "../services/api";
import { todayISO, fmt, fmtPct, fmtCurrency } from "../utils";
import ScoreBadge from "../components/ScoreBadge";
import StatusBadge from "../components/StatusBadge";
import ModeToggle from "../components/ModeToggle";
import { List, Search, Play, Loader2 } from "lucide-react";

export default function Candidates() {
  const [searchParams] = useSearchParams();
  const urlMode: Mode = searchParams.get("mode") === "INTRADAY" ? "INTRADAY" : "SWING";
  const urlDate = searchParams.get("date") ?? todayISO();
  const [date, setDate] = useState(urlDate);
  const [mode, setMode] = useState<Mode>(urlMode);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const load = async (d: string, m: Mode) => {
    setLoading(true);
    try { setData(await api.candidates(d, 200, m)); } catch {}
    setLoading(false);
  };

  useEffect(() => { load(date, mode); }, [date, mode]);

  const runAnalysis = async () => {
    setRunning(true);
    try {
      await api.runAnalysis(date, mode === "INTRADAY" ? "INTRADAY" : "EOD", mode);
      await load(date, mode);
    } catch {}
    setRunning(false);
  };

  let items = data?.candidates ?? [];
  if (search) {
    const q = search.toLowerCase();
    items = items.filter((c: any) =>
      c.symbol?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)
    );
  }

  items = [...items].sort((a: any, b: any) => {
    let va = a[sortKey], vb = b[sortKey];
    if (va === null || va === undefined) va = sortDir === "asc" ? Infinity : -Infinity;
    if (vb === null || vb === undefined) vb = sortDir === "asc" ? Infinity : -Infinity;
    if (sortKey === "symbol") { va = String(va); vb = String(vb); return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va); }
    return sortDir === "asc" ? Number(va) - Number(vb) : Number(vb) - Number(va);
  });

  const toggle = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "rank" || key === "symbol" ? "asc" : "desc"); }
  };

  const TH = ({ label, k }: { label: string; k: string }) => (
    <th
      className="pb-2 pr-3 text-left text-[10px] uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-300 select-none"
      onClick={() => toggle(k)}
    >
      {label} {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <List className="text-emerald-400" size={22} />
          Stock Candidates
        </h1>
        <div className="flex items-center gap-3">
          <ModeToggle mode={mode} onChange={(m) => { setMode(m); load(date, m); }} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          <button onClick={runAnalysis} disabled={running} className="btn-primary flex items-center gap-2">
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Run {mode}
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search symbol or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-full pl-9"
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="card text-center text-gray-500 py-8">
          {data?.runStatus == null
            ? `Run ${mode} analysis first.`
            : data?.runStatus === "FAILED"
            ? `${mode} analysis failed.`
            : `${mode} analysis completed \u2014 no qualifying candidates found.`}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <TH label="#" k="rank" />
                <TH label="Symbol" k="symbol" />
                <TH label="Score" k="score" />
                <TH label="Status" k="status" />
                <TH label="Trend" k="trend" />
                <TH label="LTP" k="ltp" />
                <TH label="Breakout" k="breakoutLevel" />
                <TH label="R:R" k="riskReward1" />
                <TH label="Chg%" k="changePercent" />
              </tr>
            </thead>
            <tbody>
              {items.map((c: any) => (
                <tr key={c.symbol} className="table-row">
                  <td className="py-2.5 pr-3 text-gray-500">{c.rank}</td>
                  <td className="py-2.5 pr-3">
                    <Link to={`/candidates/${c.symbol}?date=${date}&mode=${mode}`} className="font-semibold text-gray-100 hover:text-emerald-400 transition-colors">
                      {c.symbol}
                    </Link>
                    <span className="text-gray-500 text-xs ml-2">{c.company}</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <ScoreBadge score={c.score} classification={c.classification} />
                    {c.explainableScore != null && (
                      <span className="block text-[9px] text-gray-500 mt-0.5">exp. {Number(c.explainableScore).toFixed(1)}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3"><StatusBadge status={c.status} /></td>
                  <td className={`py-2.5 pr-3 text-xs font-bold uppercase ${c.trend === "BULLISH" ? "text-emerald-400" : c.trend === "BEARISH" ? "text-red-400" : "text-gray-400"}`}>
                    {c.trend ?? "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono">{fmtCurrency(c.ltp)}</td>
                  <td className="py-2.5 pr-3 text-xs text-gray-400">
                    {c.breakoutLevel ? fmtCurrency(c.breakoutLevel) : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-xs">
                    {c.riskReward1 != null ? (c.riskReward1 >= 2 ? <span className="text-emerald-400">1:{Number(c.riskReward1).toFixed(1)}</span> : <span className="text-amber-400">1:{Number(c.riskReward1).toFixed(1)}</span>) : "—"}
                  </td>
                  <td className={`py-2.5 pr-3 text-right font-mono ${(c.changePercent ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtPct(c.changePercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
