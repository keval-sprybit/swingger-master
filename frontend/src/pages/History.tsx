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
            <div key={d.tradingDate} className="card flex items-center justify-between py-3 hover:border-gray-700 transition-colors">
              <div>
                <p className="font-bold text-gray-100">{d.tradingDate}</p>
                <p className="text-xs text-gray-500">{d.completeness.received}/{d.completeness.expected} reports · {d.stocksAnalyzed} stocks analyzed</p>
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
          ))}
        </div>
      )}
    </div>
  );
}
