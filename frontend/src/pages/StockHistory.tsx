import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../services/api";
import { fmtPct, fmtCurrency } from "../utils";
import ScoreBadge from "../components/ScoreBadge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { ArrowLeft } from "lucide-react";

export default function StockHistory() {
  const { symbol } = useParams<{ symbol: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    api.stockHistory(symbol).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [symbol]);

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;
  if (!data || !data.history?.length) return <div className="text-center py-8 text-gray-500">No history found for {symbol}.</div>;

  const history = data.history.map((h: any) => ({
    date: h.tradingDate.slice(5),
    fullDate: h.tradingDate,
    ltp: h.ltp,
    score: h.score,
    change: h.changePercent,
    volumeRatio: h.volumeRatio,
    is52wHigh: h.is52wHigh,
  })).reverse();

  // Trend detection
  const recent = history.slice(-5);
  let trend = "N/A";
  if (recent.length >= 3) {
    const scores = recent.map((h: any) => h.score ?? 0).filter(Boolean);
    if (scores.length >= 2) {
      const improving = scores[scores.length - 1] > scores[0];
      const persisting = scores[scores.length - 1] > 60;
      trend = improving && persisting ? "BUILDING / CONTINUING" : scores[scores.length - 1] < scores[0] ? "WEAKENING" : "STABLE";
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/history" className="text-gray-500 hover:text-gray-300"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-bold text-gray-100">{symbol} <span className="text-gray-500 text-base">{data.company}</span></h1>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">Trend: {trend}</span>
      </div>

      {/* Charts */}
      {history.length >= 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <p className="text-xs text-gray-500 mb-2">Score History</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="score" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 mb-2">Volume Ratio</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="volumeRatio" fill="#6366f1" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-[10px] uppercase tracking-wider border-b border-gray-800">
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4">Score</th>
              <th className="pb-2 pr-4">LTP</th>
              <th className="pb-2 pr-4">Change%</th>
              <th className="pb-2 pr-4">Vol Ratio</th>
              <th className="pb-2 pr-4">52W High</th>
              <th className="pb-2 pr-4">Sources</th>
            </tr>
          </thead>
          <tbody>
            {data.history.map((h: any) => (
              <tr key={h.tradingDate} className="table-row">
                <td className="py-2 pr-4">{h.tradingDate}</td>
                <td className="py-2 pr-4">{h.score != null ? <ScoreBadge score={h.score} classification={h.classification ?? "D"} /> : "—"}</td>
                <td className="py-2 pr-4 font-mono">{fmtCurrency(h.ltp)}</td>
                <td className="py-2 pr-4 font-mono">{fmtPct(h.changePercent)}</td>
                <td className="py-2 pr-4 font-mono">{h.volumeRatio ? Number(h.volumeRatio).toFixed(1) + "x" : "—"}</td>
                <td className="py-2 pr-4">{h.is52wHigh ? "✓" : "—"}</td>
                <td className="py-2 pr-4 text-gray-500">{h.sourceCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
