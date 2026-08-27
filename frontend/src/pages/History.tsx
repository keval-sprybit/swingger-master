import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { Clock } from "lucide-react";

export default function History() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.history().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;
  const days = data?.history ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
        <Clock className="text-emerald-400" size={22} />
        Historical Analysis
      </h1>
      {days.length === 0 ? (
        <div className="card text-center text-gray-500 py-8">No historical data yet. Run EOD analysis.</div>
      ) : (
        <div className="space-y-2">
          {days.map((d: any) => (
            <div key={d.tradingDate} className="card flex flex-col gap-2 py-3 hover:border-gray-700 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-100">{d.tradingDate}</p>
                  <p className="text-xs text-gray-500">{d.completeness.received}/{d.completeness.expected} reports · {d.stocksAnalyzed} stocks analyzed · {d.snapshotCount} snapshot(s)</p>
                </div>
                <div className="flex items-center gap-4">
                  {d.topCandidate && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Top</p>
                      <Link to={`/candidates/${d.topCandidate.symbol}?date=${d.tradingDate}`} className="font-semibold text-gray-100 hover:text-emerald-400">
                        {d.topCandidate.symbol}
                      </Link>
                      <span className="text-xs text-gray-400 ml-2">{d.topCandidate.score}</span>
                    </div>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    d.analysisStatus === "COMPLETED" ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400" :
                    d.analysisStatus === "PARTIAL" ? "bg-amber-600/20 border-amber-500/30 text-amber-400" :
                    "bg-gray-700/20 border-gray-600/30 text-gray-400"
                  }`}>{d.analysisStatus ?? "—"}</span>
                </div>
              </div>
              {d.snapshots && d.snapshots.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pl-1">
                  {d.snapshots.map((s: any, i: number) => {
                    const time = s.createdAt ? new Date(s.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                    return (
                      <Link
                        key={i}
                        to={`/?date=${d.tradingDate}&snapshot=${s.version}`}
                        className="inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-md border border-gray-700 bg-gray-800/40 hover:border-emerald-500/40 hover:text-emerald-300 text-gray-300"
                        title={`Snapshot v${s.version} — ${s.reportCount} reports (${(s.reportTypes || []).join(", ")})`}
                      >
                        <span className="font-semibold">{s.analysisType}</span>
                        <span className="text-gray-500">v{s.version}</span>
                        <span className="text-gray-500">{time}</span>
                        <span className="text-gray-600">{s.reportCount} reports</span>
                        {s.topCandidate && <span className="text-emerald-400">★ {s.topCandidate.symbol}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
