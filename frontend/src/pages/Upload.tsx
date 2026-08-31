import { useState, useCallback } from "react";
import { api } from "../services/api";
import StatusBadge from "../components/StatusBadge";
import { Upload as UploadIcon, X, CheckCircle2, AlertTriangle, FileWarning, Loader2, RefreshCw } from "lucide-react";

const REPORT_TYPES = [
  "MOST_ACTIVE_VOLUME", "MOST_ACTIVE_VALUE", "VOLUME_GAINERS",
  "TOP_GAINERS", "TOP_LOSERS", "WEEK52_HIGH", "WEEK52_LOW", "LARGE_DEALS",
];

const REPORT_LABELS: Record<string, string> = {
  MOST_ACTIVE_VOLUME: "Most Active by Volume",
  MOST_ACTIVE_VALUE: "Most Active by Value",
  VOLUME_GAINERS: "Volume Gainers",
  TOP_GAINERS: "Top 20 Gainers",
  TOP_LOSERS: "Top 20 Losers",
  WEEK52_HIGH: "New 52 Week High",
  WEEK52_LOW: "New 52 Week Low",
  LARGE_DEALS: "Large Deals / Bulk Deals",
  BHAVCOPY: "NSE Bhavcopy / Daily Price Data",
};

export default function Upload() {
  const [files, setFiles] = useState<File[]>([]);
  const [analysisType, setAnalysisType] = useState("EOD");
  const [forceReportType, setForceReportType] = useState("");
  const [forceDate, setForceDate] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith(".csv"));
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    e.target.value = "";
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const uploadAll = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const res = await api.uploadFiles(files, {
        reportType: forceReportType || undefined,
        analysisType,
        tradingDate: forceDate || undefined,
      });
      setResults(res.results || []);
    } catch (err: any) {
      setResults([{ filename: "—", status: "FAILED", errors: [err.message] }]);
    }
    setUploading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
        <UploadIcon className="text-emerald-400" size={22} />
        Upload NSE CSV Reports
      </h1>

      {/* Drag area */}
      <div
        className={`card border-2 border-dashed transition-colors cursor-pointer ${
          dragOver ? "border-emerald-500 bg-emerald-500/5" : "border-gray-700 hover:border-gray-600"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById("fileInput")?.click()}
      >
        <input type="file" id="fileInput" multiple accept=".csv" className="hidden" onChange={addFiles} />
        <div className="text-center py-8">
          <UploadIcon size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400 text-sm">Drag & drop CSV files here, or click to select</p>
          <p className="text-gray-600 text-xs mt-1">Supports all NSE report types</p>
        </div>
      </div>

      {/* File list + options */}
      {files.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-200">{files.length} file{files.length > 1 ? "s" : ""} selected</h3>
            <button onClick={() => setFiles([])} className="text-red-400 text-xs hover:text-red-300">Clear all</button>
          </div>

          <div className="space-y-1 max-h-40 overflow-y-auto">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-800/50">
                <span className="text-gray-300 truncate max-w-[70%]">{f.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 text-xs">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeFile(i)} className="text-gray-500 hover:text-red-400"><X size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase text-gray-500 mb-1 block">Analysis Type</label>
              <select value={analysisType} onChange={(e) => setAnalysisType(e.target.value)} className="input w-full">
                <option value="EOD">EOD (End of Day)</option>
                <option value="INTRADAY">Intraday</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-500 mb-1 block">Force Report Type (optional)</label>
              <select value={forceReportType} onChange={(e) => setForceReportType(e.target.value)} className="input w-full">
                <option value="">Auto-detect</option>
                <optgroup label="NSE Screening Reports">
                  {REPORT_TYPES.map((t) => <option key={t} value={t}>{REPORT_LABELS[t] ?? t.replace(/_/g, " ")}</option>)}
                </optgroup>
                <optgroup label="Price Data">
                  <option value="BHAVCOPY">{REPORT_LABELS.BHAVCOPY}</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-500 mb-1 block">Force Date (optional)</label>
              <input type="date" value={forceDate} onChange={(e) => setForceDate(e.target.value)} className="input w-full" />
            </div>
          </div>

          <button onClick={uploadAll} disabled={uploading} className="btn-primary w-full flex items-center justify-center gap-2">
            {uploading ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : `Upload ${files.length} file${files.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-200">Results</h3>
          {results.map((r: any, i: number) => (
            <div key={i} className={`card text-sm ${
              r.status === "PROCESSED" ? "border-emerald-700/30" :
              r.status === "REUSED" ? "border-blue-700/30" :
              r.status === "DUPLICATE" ? "border-yellow-700/30" :
              "border-red-700/30"
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {r.status === "PROCESSED" && <CheckCircle2 size={14} className="text-emerald-400" />}
                    {r.status === "REUSED" && <RefreshCw size={14} className="text-blue-400" />}
                    {r.status === "DUPLICATE" && <AlertTriangle size={14} className="text-yellow-400" />}
                    {(r.status === "FAILED" || r.status === "NEEDS_REVIEW") && <FileWarning size={14} className="text-red-400" />}
                    <span className="font-semibold text-gray-100">{r.filename}</span>
                  </div>
                  <div className="mt-1.5 space-y-0.5 text-xs text-gray-400">
                    <p>Status: <span className="font-medium text-gray-200">{r.status}</span></p>
                    {r.status === "REUSED" && (
                      <p className="text-blue-300">Report unchanged — reused from a previous snapshot. No new file stored. Data upload #{r.reusedFromUploadId}.</p>
                    )}
                    {r.reportType && <p>Report: {REPORT_LABELS[r.reportType] ?? r.reportType.replace(/_/g, " ")}</p>}
                    {r.tradingDate && <p>Report Trading Date: <span className="font-medium text-gray-200">{r.tradingDate}</span></p>}
                    {r.filenameDate && r.tradingDate && r.filenameDate !== r.tradingDate && (
                      <p>Filename Date: {r.filenameDate}</p>
                    )}
                    {r.dealDatesDetected && <p>Rows' Deal Date: may differ from the report trading date (preserved separately).</p>}
                    {r.validRows !== undefined && <p>Rows: {r.validRows} valid{r.invalidRows ? `, ${r.invalidRows} invalid` : ""}</p>}
                    {r.candidates && r.candidates.length > 0 && <p>Possible types: {r.candidates.join(", ")}</p>}
                    {r.storedFilename && <p>Stored: {r.storedFilename}</p>}
                  </div>
                  {r.tradeDateWarning && (
                    <div className="mt-2 p-2 rounded bg-amber-900/20 text-amber-400 text-xs flex items-start gap-2">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      <span>{r.tradeDateWarning} Row-level deal dates are preserved separately and are not used as the report date.</span>
                    </div>
                  )}
                </div>
                {r.status === "NEEDS_REVIEW" && (
                  <p className="text-xs text-amber-400 mt-1">Select report type above and re-upload</p>
                )}
              </div>
              {r.errors && r.errors.length > 0 && (
                <div className="mt-2 p-2 rounded bg-red-900/20 text-red-400 text-xs">
                  {r.errors.map((e: string, j: number) => <p key={j}>{e}</p>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Help */}
      <div className="card text-xs text-gray-500 space-y-1">
        <p className="font-bold text-gray-400">Supported NSE Reports:</p>
        <p>Most Active by Volume, Most Active by Value, Volume Gainers, New 52 Week High, New 52 Week Low, Top 20 Gainers, Top 20 Losers, Large Deals / Bulk Deals</p>
        <p className="mt-2">Price Data: NSE Bhavcopy / Daily Price Data (CM-UDiFF or standard bhavcopy format). This is stored separately as daily price-volume history and does not count toward the 8-report screening set.</p>
        <p className="mt-2">The system automatically detects the report type and trading date from the CSV headers and filename. If detection is uncertain, select the type manually above.</p>
      </div>
    </div>
  );
}
