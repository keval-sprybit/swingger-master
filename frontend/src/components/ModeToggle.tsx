import type { Mode } from "../services/api";

export default function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const btn = (m: Mode, label: string, sub: string) => (
    <button
      type="button"
      onClick={() => onChange(m)}
      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors text-left ${
        mode === m
          ? "bg-emerald-600/25 border border-emerald-500/40 text-emerald-300"
          : "bg-gray-800/50 border border-gray-700 text-gray-400 hover:text-gray-200"
      }`}
    >
      {label}
      <span className={`block text-[9px] font-normal ${mode === m ? "text-emerald-400/70" : "text-gray-600"}`}>{sub}</span>
    </button>
  );

  return (
    <div className="inline-flex rounded-lg bg-gray-900/60 border border-gray-800 p-1 gap-1">
      {btn("SWING", "SWING", "Next-session analysis")}
      {btn("INTRADAY", "INTRADAY", "Today's intraday")}
    </div>
  );
}

export const MODE_LABEL: Record<Mode, string> = {
  SWING: "NEXT SESSION SWING ANALYSIS",
  INTRADAY: "TODAY'S INTRADAY ANALYSIS",
};