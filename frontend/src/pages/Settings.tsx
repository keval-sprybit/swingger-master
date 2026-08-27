import { useEffect, useState } from "react";
import { api } from "../services/api";
import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { api.settings().then(setSettings).catch(() => {}); }, []);

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      await api.updateSettings(settings);
      setMsg("Settings saved.");
    } catch (e: any) {
      setMsg("Error: " + e.message);
    }
    setSaving(false);
  };

  if (!settings) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
        <SettingsIcon className="text-emerald-400" size={22} />
        Settings
      </h1>
      <div className="card space-y-5">
        <div>
          <label className="text-[10px] uppercase text-gray-500 mb-1 block">Capital per Trade (₹)</label>
          <input type="number" value={settings.capital} onChange={(e) => setSettings({ ...settings, capital: +e.target.value })} className="input w-full" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-gray-500 mb-1 block">Risk per Trade (%)</label>
          <input type="number" step="0.1" value={settings.riskPercent} onChange={(e) => setSettings({ ...settings, riskPercent: +e.target.value })} className="input w-full" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-gray-500 mb-1 block">Minimum Risk/Reward Ratio</label>
          <input type="number" step="0.1" value={settings.minRiskReward} onChange={(e) => setSettings({ ...settings, minRiskReward: +e.target.value })} className="input w-full" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-gray-500 mb-1 block">Max Watchlist Size</label>
          <input type="number" value={settings.maxWatchlistSize} onChange={(e) => setSettings({ ...settings, maxWatchlistSize: +e.target.value })} className="input w-full" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save Settings"}</button>
          {msg && <span className={`text-sm ${msg.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}
