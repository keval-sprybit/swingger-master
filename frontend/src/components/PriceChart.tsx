import { useMemo, useRef, useState } from "react";
import { fmtCurrency } from "../utils";

// Self-contained candlestick / price chart rendered as raw SVG.
//
// Draws REAL stored OHLC bars from the backend (single source of truth) plus
// SMA lines and the analysis levels (breakout / entry zone / stop / targets /
// support / resistance). Everything is computed from the chart payload that the
// backend returns — nothing is invented or recalculated in the frontend.
//
// This component reuses the project's existing data flow (api.stockChart) and
// matches the dark theme. It is intentionally light (no extra chart library).

export interface CandleDatum {
  date: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  sma20?: number | null;
  sma50?: number | null;
  sma200?: number | null;
  [key: string]: any;
}

export interface ChartLine {
  label: string;
  key: "sma20" | "sma50" | "sma200";
  color: string;
}

export interface ChartHLine {
  key: string;
  label: string;
  value: number | null;
  color: string;
  dash?: string;
}

export interface ChartHArea {
  key: string;
  label: string;
  low: number | null;
  high: number | null;
  color: string;
}

interface Packed {
  data: { d: CandleDatum; x: number; w: number; y: number; h: number }[];
  yFor: (v: number) => number;
  yMin: number;
  yMax: number;
}

const COLORS = {
  up: "#22c55e",
  down: "#ef4444",
  grid: "#1f2937",
  axis: "#6b7280",
  bg: "#0b1220",
};

// Safely extract a displayable date string; never throws and never shows `undefined`.
function dateStr(d: any): string {
  const v = d?.date ?? d?.tradingDate;
  return typeof v === "string" ? v : "";
}

// Pack candles into pixel coordinates within a viewBox of given width/height,
// reserving space for price-axis labels on the right.
function pack(data: CandleDatum[], width: number, height: number, axisW = 56): Packed {
  const sorted = [...data].sort((a, b) => (dateStr(a) < dateStr(b) ? -1 : dateStr(a) > dateStr(b) ? 1 : 0));
  const plotW = Math.max(20, width - axisW - 8);
  const n = sorted.length;
  const slot = plotW / n;
  const bw = Math.max(1, Math.min(24, slot * 0.7));
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const d of sorted) {
    if (Number.isFinite(d.l)) yMin = Math.min(yMin, d.l);
    if (Number.isFinite(d.h)) yMax = Math.max(yMax, d.h);
    if (d.sma20 != null) { yMin = Math.min(yMin, d.sma20); yMax = Math.max(yMax, d.sma20); }
    if (d.sma50 != null) { yMin = Math.min(yMin, d.sma50); yMax = Math.max(yMax, d.sma50); }
    if (d.sma200 != null) { yMin = Math.min(yMin, d.sma200); yMax = Math.max(yMax, d.sma200); }
  }
  if (yMin === Infinity) { yMin = 0; yMax = 1; }
  const pad = (yMax - yMin) * 0.06 || 1;
  yMin -= pad;
  yMax += pad;
  const yFor = (v: number) => height - ((v - yMin) / (yMax - yMin)) * height;
  const pts = sorted.map((d, i) => {
    const x = i * slot;
    // Make the dataKey value high cover full slot; candle drawn from OHLC.
    const yTop = yFor(d.h);
    const yBot = yFor(d.l);
    return { d, x, w: bw, y: yTop, h: Math.max(1, yBot - yTop) };
  });
  return { data: pts, yFor, yMin, yMax };
}

export default function PriceChart({
  data,
  lines = [],
  hlines = [],
  hareas = [],
  height = 380,
}: {
  data: CandleDatum[];
  lines?: ChartLine[];
  hlines?: ChartHLine[];
  hareas?: ChartHArea[];
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const W = Math.max(320, w);
  const chartArea = height - 24;

  useMemo(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => { for (const e of es) setW(e.contentRect.width); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const showCandles = data.every((d) => d.o != null && d.h != null && d.l != null && d.c != null);
  const p = useMemo(() => pack(data, W, chartArea), [data, W, chartArea]);

  // Name-to-y for level lines (they may extend beyond plotted candle range).
  const allLevels: { key: string; label: string; value: number | null; color: string; dash: string }[] = [];
  for (const l of hlines) {
    if (l.value != null) {
      allLevels.push({ ...l, dash: l.dash ?? "6 3" });
    }
  }
  const srcY = p.yFor;
  const yMin = p.yMin;
  const yMax = p.yMax;

  // Map a level value that may be outside candle range into chart coords using
  // the same scale (clamped for display but labelled with true value).
  const levelY = (v: number) => Math.max(0, Math.min(chartArea, srcY(v)));

  // Gridline ticks (nice numbers).
  const ticks = useMemo(() => {
    const span = yMax - yMin || 1;
    const rough = span / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : norm >= 1 ? 1 : 0.5) * mag;
    const out: number[] = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) out.push(v);
    return out;
  }, [yMin, yMax]);

  const [hover, setHover] = useState<Packed["data"][number] | null>(null);

  // x label ticks every ~40px
  const labelEvery = Math.max(1, Math.round(40 / (W / p.data.length)));

  return (
    <div ref={ref} className="relative" style={{ width: "100%" }}>
      <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} style={{ display: "block" }}>
        <rect x={0} y={0} width={W} height={height} fill={COLORS.bg} />
        {/* grid + price axis */}
        {ticks.map((t, i) => {
          const y = srcY(t);
          return (
            <g key={i}>
              <line x1={0} x2={W - 26} y1={y} y2={y} stroke={COLORS.grid} strokeWidth={1} />
              <text x={W - 18} y={y + 3} fontSize={9} fill={COLORS.axis} textAnchor="end">
                {typeof t === "number" ? t.toFixed(t >= 1000 ? 0 : 1) : t}
              </text>
            </g>
          );
        })}

        {/* date labels */}
        {p.data.map((pt, i) =>
          i % labelEvery === 0 && dateStr(pt.d) ? (
            <text key={i} x={pt.x + pt.w / 2} y={height - 7} fontSize={9} fill={COLORS.axis} textAnchor="middle">
              {dateStr(pt.d).slice(5)}
            </text>
          ) : null
        )}

        {/* entry zone */}
        {hareas.map((a) => {
          if (a.low == null || a.high == null) return null;
          const yTop = Math.max(0, Math.min(chartArea, srcY(a.high)));
          const yBot = Math.max(0, Math.min(chartArea, srcY(a.low)));
          return (
            <g key={a.key}>
              <rect x={0} y={yTop} width={W - 26} height={Math.max(1, yBot - yTop)} fill={a.color} opacity={0.14} />
              <text x={4} y={yTop - 3} fontSize={9} fill={a.color}>{a.label}</text>
            </g>
          );
        })}

        {/* level lines */}
        {allLevels.map((l, i) => {
          if (l.value == null) return null;
          const y = levelY(l.value);
          const dash = l.dash.split(" ");
          return (
            <g key={l.key + i}>
              <line x1={0} x2={W - 26} y1={y} y2={y} stroke={l.color} strokeWidth={1.2} strokeDasharray={l.dash} />
              <rect x={W - 26 - (l.label.length * 6 + 8)} y={y - 9} width={l.label.length * 6 + 8} height={12} rx={2} fill="rgba(11,18,32,0.85)" />
              <text x={W - 30} y={y + 3} fontSize={9} fill={l.color} textAnchor="end">{l.label} {fmtCurrency(l.value)}</text>
            </g>
          );
        })}

        {/* SMA lines */}
        {lines.map((ln) => (
          <polyline
            key={ln.key}
            fill="none"
            stroke={ln.color}
            strokeWidth={1.4}
            points={p.data
              .map((pt) => {
                const v = pt.d[ln.key];
                return v != null ? `${pt.x + pt.w / 2},${srcY(v)}` : null;
              })
              .filter((s): s is string => s != null)
              .join(" ")}
          />
        ))}

        {/* candles */}
        {showCandles &&
          p.data.map((pt, i) => {
            const d = pt.d;
            const up = d.c >= d.o;
            const color = up ? COLORS.up : COLORS.down;
            const wickX = pt.x + pt.w / 2;
            const bw = Math.max(1, pt.w * 0.7);
            const bodyW = bw;
            const bodyX = pt.x + (pt.w - bodyW) / 2;
            const top = Math.min(srcY(d.o), srcY(d.c));
            const bot = Math.max(srcY(d.o), srcY(d.c));
            return (
              <g
                key={i}
                onMouseEnter={() => setHover(pt)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                <rect x={pt.x} y={0} width={pt.w} height={chartArea} fill={hover === pt ? "rgba(148,163,184,0.06)" : "transparent"} />
                <line x1={wickX} x2={wickX} y1={srcY(d.h)} y2={srcY(d.l)} stroke={color} strokeWidth={1} />
                <rect x={bodyX} y={top} width={bodyW} height={Math.max(1, bot - top)} fill={color} />
              </g>
            );
          })}

        {/* hover crosshair */}
        {hover && (
          <line x1={hover.x + hover.w / 2} x2={hover.x + hover.w / 2} y1={0} y2={chartArea} stroke="#64748b" strokeWidth={1} strokeDasharray="3 3" />
        )}
      </svg>

      {/* tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-200 shadow-xl"
          style={{ left: Math.min(W - 190, hover.x + 8), top: 8, zIndex: 20 }}
        >
          <div className="mb-1 font-bold text-slate-100">{dateStr(hover.d) || "—"}</div>
          {hover.d.o != null && <div>Open: <b>{fmtCurrency(hover.d.o)}</b></div>}
          {hover.d.h != null && <div>High: <span className="text-emerald-400">{fmtCurrency(hover.d.h)}</span></div>}
          {hover.d.l != null && <div>Low: <span className="text-red-400">{fmtCurrency(hover.d.l)}</span></div>}
          {hover.d.c != null && <div>Close: <b>{fmtCurrency(hover.d.c)}</b></div>}
          {hover.d.v != null && <div>Volume: <span className="text-slate-400">{Number(hover.d.v).toLocaleString("en-IN")}</span></div>}
          {hover.d.sma20 != null && <div className="text-indigo-300">20 DMA: {fmtCurrency(hover.d.sma20)}</div>}
          {hover.d.sma50 != null && <div className="text-sky-300">50 DMA: {fmtCurrency(hover.d.sma50)}</div>}
          {hover.d.sma200 != null && <div className="text-amber-300">200 DMA: {fmtCurrency(hover.d.sma200)}</div>}
        </div>
      )}
    </div>
  );
}

export function VolumeChart({ data, height = 110 }: { data: CandleDatum[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const W = Math.max(320, w);
  useMemo(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => { for (const e of es) setW(e.contentRect.width); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const sorted = useMemo(() => [...data].sort((a, b) => (dateStr(a) < dateStr(b) ? -1 : dateStr(a) > dateStr(b) ? 1 : 0)), [data]);
  if (!sorted.length) return <div className="py-6 text-center text-sm text-gray-500">Volume data unavailable.</div>;
  const maxV = Math.max(...sorted.map((d) => d.v ?? 0), 1);
  const slot = W / sorted.length;
  const bw = Math.max(1, Math.min(24, slot * 0.7));
  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} style={{ display: "block" }}>
        <rect x={0} y={0} width={W} height={height} fill={COLORS.bg} />
        <line x1={0} x2={W} y1={0.5} y2={0.5} stroke={COLORS.grid} />
        {sorted.map((d, i) => {
          const up = d.c >= d.o;
          const color = up ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)";
          const bh = Math.max(1, (d.v / maxV) * (height - 16));
          return <rect key={i} x={i * slot + (slot - bw) / 2} y={height - 8 - bh} width={bw} height={bh} fill={color} />;
        })}
      </svg>
    </div>
  );
}

export function ChartLegend({ lines, hlines, hareas, indicators }: {
  lines?: ChartLine[];
  hlines?: ChartHLine[];
  hareas?: ChartHArea[];
  indicators?: { label: string; value: any }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400">
      {lines?.map((l) => (
        <span key={l.key} className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-0.5" style={{ background: l.color }} /> {l.label}
        </span>
      ))}
      {hareas?.map((a) => (
        <span key={a.key} className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: `${a.color}33`, border: `1px solid ${a.color}` }} /> {a.label}
        </span>
      ))}
      {hlines?.map((l) => (
        <span key={l.key} className="flex items-center gap-1">
          <span className="inline-block w-3 border-t" style={{ borderColor: l.color }} /> {l.label}
        </span>
      ))}
      {indicators?.map((ind) => (
        <span key={ind.label} className="flex items-center gap-1">
          {ind.label}: <b className="text-gray-200">{ind.value ?? "—"}</b>
        </span>
      ))}
    </div>
  );
}
