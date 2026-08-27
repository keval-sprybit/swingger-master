import { useEffect, useState } from "react";
import { api } from "../services/api";
import { fmtCurrency, fmtPct, todayISO } from "../utils";
import { ArrowRightLeft } from "lucide-react";

export default function PaperTrading() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    symbol: "", stockId: 0, entryDate: todayISO(), entryPrice: 0, stopLoss: 0,
    target1: null as number | null, target2: null as number | null, quantity: 0,
    exitDate: "", exitPrice: null as number | null, result: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await api.paperTrades();
      setData(res);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.createPaperTrade({
        symbol: form.symbol.toUpperCase(),
        stockId: form.stockId || 1,
        entryDate: form.entryDate,
        entryPrice: form.entryPrice,
        stopLoss: form.stopLoss,
        target1: form.target1,
        target2: form.target2,
        quantity: form.quantity,
        exitDate: form.exitDate || null,
        exitPrice: form.exitPrice,
        result: form.result || null,
        notes: form.notes || null,
      });
      setShowForm(false);
      setForm({ symbol: "", stockId: 0, entryDate: todayISO(), entryPrice: 0, stopLoss: 0, target1: null, target2: null, quantity: 0, exitDate: "", exitPrice: null, result: "", notes: "" });
      load();
    } catch {}
    setSaving(false);
  };

  const stats = data?.stats;
  const trades = data?.trades ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <ArrowRightLeft className="text-emerald-400" size={22} />
          Paper Trading
        </h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? "Cancel" : "Record Trade"}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard label="Total" value={String(stats.total)} />
          <StatCard label="Wins" value={String(stats.wins)} color="text-emerald-400" />
          <StatCard label="Losses" value={String(stats.losses)} color="text-red-400" />
          <StatCard label="Open" value={String(stats.open)} color="text-amber-400" />
          <StatCard label="Win Rate" value={`${Number(stats.winRate).toFixed(1)}%`} />
          <StatCard label="Avg Profit" value={fmtCurrency(stats.avgProfit)} color="text-emerald-400" />
          <StatCard label="Avg Loss" value={fmtCurrency(stats.avgLoss)} color="text-red-400" />
          <StatCard label="Total P/L" value={fmtCurrency(stats.totalPL)} color={stats.totalPL >= 0 ? "text-emerald-400" : "text-red-400"} />
        </div>
      )}

      {showForm && (
        <div className="card space-y-4">
          <h3 className="font-bold text-gray-100">Record Paper Trade</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input label="Symbol" value={form.symbol} onChange={(v) => setForm({ ...form, symbol: v })} />
            <Input label="Entry Date" type="date" value={form.entryDate} onChange={(v) => setForm({ ...form, entryDate: v })} />
            <Input label="Entry Price" type="number" value={form.entryPrice} onChange={(v) => setForm({ ...form, entryPrice: +v })} />
            <Input label="Stop Loss" type="number" value={form.stopLoss} onChange={(v) => setForm({ ...form, stopLoss: +v })} />
            <Input label="Target 1" type="number" value={form.target1 ?? ""} onChange={(v) => setForm({ ...form, target1: v ? +v : null })} />
            <Input label="Target 2" type="number" value={form.target2 ?? ""} onChange={(v) => setForm({ ...form, target2: v ? +v : null })} />
            <Input label="Quantity" type="number" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: +v })} />
            <Input label="Exit Date" type="date" value={form.exitDate} onChange={(v) => setForm({ ...form, exitDate: v })} />
            <Input label="Exit Price" type="number" value={form.exitPrice ?? ""} onChange={(v) => setForm({ ...form, exitPrice: v ? +v : null })} />
            <Input label="Result" value={form.result} onChange={(v) => setForm({ ...form, result: v })} />
          </div>
          <Input label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} wide />
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save Trade"}</button>
        </div>
      )}

      {/* Trades list */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : trades.length === 0 ? (
        <div className="card text-center text-gray-500 py-8">No paper trades yet. Record one above.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-[10px] uppercase tracking-wider border-b border-gray-800">
                <th className="pb-2 pr-3">Symbol</th>
                <th className="pb-2 pr-3">Entry Date</th>
                <th className="pb-2 pr-3 text-right">Entry</th>
                <th className="pb-2 pr-3 text-right">Stop</th>
                <th className="pb-2 pr-3 text-right">Qty</th>
                <th className="pb-2 pr-3">Exit Date</th>
                <th className="pb-2 pr-3 text-right">Exit</th>
                <th className="pb-2 pr-3 text-right">P/L</th>
                <th className="pb-2 pr-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t: any) => (
                <tr key={t.id} className="table-row">
                  <td className="py-2 pr-3 font-bold text-gray-100">{t.symbol}</td>
                  <td className="py-2 pr-3 text-gray-400">{t.entryDate?.slice(0, 10)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmtCurrency(t.entryPrice)}</td>
                  <td className="py-2 pr-3 text-right font-mono text-red-400">{fmtCurrency(t.stopLoss)}</td>
                  <td className="py-2 pr-3 text-right">{t.quantity}</td>
                  <td className="py-2 pr-3 text-gray-400">{t.exitDate?.slice(0, 10) ?? "Open"}</td>
                  <td className="py-2 pr-3 text-right font-mono">{t.exitPrice != null ? fmtCurrency(t.exitPrice) : "—"}</td>
                  <td className={`py-2 pr-3 text-right font-mono font-bold ${t.profitLoss != null && t.profitLoss >= 0 ? "text-emerald-400" : t.profitLoss != null ? "text-red-400" : "text-gray-500"}`}>
                    {t.profitLoss != null ? fmtCurrency(t.profitLoss) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-xs text-gray-400">{t.result ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card text-center">
      <p className="text-[9px] uppercase text-gray-600 mb-1">{label}</p>
      <p className={`text-sm font-bold ${color ?? "text-gray-100"}`}>{value}</p>
    </div>
  );
}

function Input({ label, value, type = "text", onChange, wide }: { label: string; value: any; type?: string; onChange: (v: string) => void; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-4" : ""}>
      <label className="text-[10px] uppercase text-gray-500 mb-1 block">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input w-full" />
    </div>
  );
}
