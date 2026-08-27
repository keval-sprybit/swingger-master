const BASE = "/api";

async function json<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export const api = {
  dashboard: (date?: string, snapshot?: number) =>
    json(`/dashboard?${date ? `date=${date}` : ""}${snapshot ? `${date ? "&" : ""}snapshot=${snapshot}` : ""}`),
  candidates: (date?: string, limit = 100) =>
    json(`/candidates?${date ? `date=${date}&` : ""}limit=${limit}`),
  candidateDetail: (symbol: string, date?: string) =>
    json(`/candidates/${encodeURIComponent(symbol)}?${date ? `date=${date}` : ""}`),
  watchlist: (date?: string) => json(`/watchlist?${date ? `date=${date}` : ""}`),
  history: () => json(`/history`),
  stockHistory: (symbol: string) =>
    json(`/stocks/${encodeURIComponent(symbol)}/history`),
  runAnalysis: (tradingDate: string, analysisType = "EOD") =>
    json("/analysis/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tradingDate, analysisType }),
    }),
  settings: () => json("/settings"),
  updateSettings: (data: Record<string, number>) =>
    json("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  paperTrades: () => json("/paper-trades"),
  createPaperTrade: (data: any) =>
    json("/paper-trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  updatePaperTrade: (id: number, data: any) =>
    json(`/paper-trades/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  uploadFiles: async (files: File[], opts: { reportType?: string; analysisType?: string; tradingDate?: string } = {}) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    if (opts.reportType) fd.append("reportType", opts.reportType);
    if (opts.analysisType) fd.append("analysisType", opts.analysisType || "EOD");
    if (opts.tradingDate) fd.append("tradingDate", opts.tradingDate);
    const res = await fetch(`${BASE}/uploads`, { method: "POST", body: fd });
    return res.json();
  },
};
