const CLASS: Record<string, { bg: string; text: string }> = {
  A_PLUS: { bg: "bg-emerald-600/20 border-emerald-500/30", text: "text-emerald-400" },
  A:     { bg: "bg-emerald-700/20 border-emerald-600/20", text: "text-emerald-300" },
  B:     { bg: "bg-blue-700/20 border-blue-600/20", text: "text-blue-300" },
  C:     { bg: "bg-yellow-700/20 border-yellow-600/20", text: "text-yellow-300" },
  D:     { bg: "bg-red-800/20 border-red-700/20", text: "text-red-400" },
};

export default function ScoreBadge({ score, classification }: { score: number; classification: string }) {
  const c = CLASS[classification] ?? CLASS.D;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${c.bg} ${c.text}`}>
      <span className="text-lg leading-none">{Number(score).toFixed(1)}</span>
      <span className="text-[10px]">{classification.replace("_", "+")}</span>
    </div>
  );
}
