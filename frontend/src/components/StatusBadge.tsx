const STATUS: Record<string, { bg: string; text: string; label: string }> = {
  BUY_SETUP:             { bg: "bg-emerald-600/20 border-emerald-500/30", text: "text-emerald-400", label: "BUY SETUP" },
  ENTRY_ACTIVE:          { bg: "bg-emerald-600/20 border-emerald-500/40", text: "text-emerald-300", label: "ENTRY ACTIVE" },
  BREAKOUT_CONFIRMED:    { bg: "bg-emerald-700/20 border-emerald-500/30", text: "text-emerald-400", label: "BREAKOUT CONFIRMED" },
  BREAKOUT_APPROACHING:  { bg: "bg-teal-600/20 border-teal-500/30",       text: "text-teal-300",   label: "BREAKOUT APPROACHING" },
  WAIT_FOR_BREAKOUT:     { bg: "bg-amber-600/20 border-amber-500/30",     text: "text-amber-400",  label: "WAIT BREAKOUT" },
  WEAK_BREAKOUT:         { bg: "bg-orange-600/20 border-orange-500/30",   text: "text-orange-300", label: "WEAK BREAKOUT" },
  MISSED:                { bg: "bg-yellow-700/20 border-yellow-600/30",    text: "text-yellow-300", label: "MISSED" },
  WAIT_FOR_PULLBACK:     { bg: "bg-blue-600/20 border-blue-500/30",       text: "text-blue-400",   label: "WAIT PULLBACK" },
  WATCH:                 { bg: "bg-gray-600/20 border-gray-500/30",       text: "text-gray-300",   label: "WATCH" },
  CHASE_RISK:            { bg: "bg-orange-600/20 border-orange-500/30",   text: "text-orange-400", label: "CHASE RISK" },
  AVOID:                 { bg: "bg-red-600/20 border-red-500/30",         text: "text-red-400",    label: "AVOID" },
  BREAKOUT_FAILED:       { bg: "bg-red-700/20 border-red-500/30",         text: "text-red-300",    label: "BREAKOUT FAILED" },
  INSUFFICIENT_DATA:     { bg: "bg-gray-700/20 border-gray-600/20",       text: "text-gray-400",   label: "INSUFFICIENT DATA" },
  NO_TRADE:              { bg: "bg-gray-800/20 border-gray-700/20",       text: "text-gray-500",   label: "NO TRADE" },
};

export default function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-600 text-xs">—</span>;
  const s = STATUS[status] ?? { bg: "bg-gray-700/20", text: "text-gray-400", label: status };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}
