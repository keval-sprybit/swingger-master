import { Response } from "express";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { runAnalysis } from "../services/analysisService.js";
import { toPlain } from "../utils/serialize.js";
import { toDateString } from "../utils/date.js";
import { REQUIRED_REPORTS } from "../config/index.js";
import { ensureTradingDay } from "../repositories/metrics.js";
import { latestUploadPerReportType, listSnapshotsForDate } from "../repositories/uploads.js";

function marketStatusNow(): "PRE_MARKET" | "OPEN" | "CLOSED" {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const t = h + m / 60;
  if (t < 9) return "PRE_MARKET";
  if (t < 15.5) return "OPEN";
  return "CLOSED";
}

async function getLatestRun(date: Date) {
  return prisma.analysisRun.findFirst({
    where: { tradingDate: date },
    orderBy: { id: "desc" },
  });
}

async function completeness(date: Date) {
  const uploads = await prisma.csvUpload.findMany({
    where: { tradingDate: date, uploadStatus: "PROCESSED" },
    select: { reportType: true },
  });
  const received = new Set(uploads.map((u) => u.reportType));
  const present = REQUIRED_REPORTS.filter((r) => received.has(r as any));
  return { received: present.length, expected: REQUIRED_REPORTS.length, missing: REQUIRED_REPORTS.filter((r) => !received.has(r as any)), reportTypes: [...received] };
}

export const analysisController = {
  run: asyncHandler(async (req: any, res: Response) => {
    const { tradingDate, analysisType } = req.body ?? {};
    if (!tradingDate) return res.status(400).json({ error: "tradingDate is required." });
    const result = await runAnalysis(tradingDate, analysisType ?? "EOD");
    res.json(result);
  }),

  dashboard: asyncHandler(async (req: any, res: Response) => {
    let dateStr = req.query.date as string | undefined;
    if (!dateStr) {
      const latest = await prisma.tradingDay.findFirst({ orderBy: { tradingDate: "desc" } });
      dateStr = latest ? toDateString(latest.tradingDate) : toDateString(new Date());
    }
    const date = new Date(dateStr + "T00:00:00");
    await ensureTradingDay(date);
    const comp = await completeness(date);
    const run = await getLatestRun(date);

    // Optional snapshot version (e.g. from the History page) selects a specific
    // intraday/EOD snapshot's report rows rather than the latest one.
    const snapshotVersion = req.query.snapshot ? Number(req.query.snapshot) : undefined;

    let scores: any[] = [];
    let setupMap = new Map<number, any>();
    if (run) {
      scores = await prisma.dailyStockScore.findMany({
        where: { analysisRunId: run.id },
        include: { stock: true },
        orderBy: { rank: "asc" },
      });
      const setups = await prisma.tradeSetup.findMany({ where: { analysisRunId: run.id } });
      setupMap = new Map(setups.map((s) => [s.stockId, s]));
    }

    const topCandidates = scores.slice(0, 15).map((s: any) => {
      const st = setupMap.get(s.stockId);
      return {
        rank: s.rank,
        symbol: s.stock.symbol,
        company: s.stock.companyName,
        score: s.normalizedScore,
        classification: s.classification,
        changePercent: s.stock ? undefined : undefined,
        ltp: st?.currentPrice ?? null,
        status: st?.status ?? null,
        signals: s.signals,
      };
    });

    // Sections — show a single snapshot per report type so that multiple
    // INTRADAY/EOD uploads for the same trading date are never combined.
    //
    // Decide which analysis type to surface:
    //  - while the market is open, show the latest INTRADAY snapshot;
    //  - after close, show the latest EOD snapshot;
    //  - when an explicit historical snapshot version is requested, use that
    //    snapshot's own analysis type.
    const marketStatus = marketStatusNow();
    const marketOpen = marketStatus !== "CLOSED";
    let sectionAnalysisType: "INTRADAY" | "EOD" = marketOpen ? "INTRADAY" : "EOD";
    if (snapshotVersion !== undefined) {
      const snapshotUpload = await prisma.csvUpload.findFirst({
        where: { tradingDate: date, uploadStatus: "PROCESSED", uploadVersion: snapshotVersion },
        orderBy: { id: "asc" },
      });
      if (snapshotUpload) sectionAnalysisType = snapshotUpload.analysisType === "EOD" ? "EOD" : "INTRADAY";
    }

    const latestEntries = await latestUploadPerReportType(date, { version: snapshotVersion, analysisType: sectionAnalysisType });
    let sectionSnapshotCreatedAt: string | null = null;
    if (snapshotVersion !== undefined) {
      const s = (await listSnapshotsForDate(date)).find((x) => x.version === snapshotVersion);
      sectionSnapshotCreatedAt = s?.createdAtISO ?? null;
    }
    const uploadIdsFor = (reportType: string): number[] | undefined =>
      latestEntries.find((e) => e.reportType === reportType)?.uploadIds;
    const idFilter = (reportType: string): { uploadId: { in: number[] } } | { tradingDate: Date } => {
      const ids = uploadIdsFor(reportType);
      return ids && ids.length > 0 ? { uploadId: { in: ids } } : { tradingDate: date };
    };

    const [maVol, maVal, volGainers, w52h, w52l, topGainers, topLosers, large] = await Promise.all([
      prisma.mostActiveVolume.findMany({ where: idFilter("MOST_ACTIVE_VOLUME") as any, orderBy: { volume: "desc" }, take: 20, include: { stock: true } }),
      prisma.mostActiveValue.findMany({ where: idFilter("MOST_ACTIVE_VALUE") as any, orderBy: { turnover: "desc" }, take: 10, include: { stock: true } }),
      prisma.volumeGainer.findMany({ where: idFilter("VOLUME_GAINERS") as any, orderBy: { volumeRatio1w: "desc" }, take: 20, include: { stock: true } }),
      prisma.week52High.findMany({ where: idFilter("WEEK52_HIGH") as any, orderBy: { ltp: "desc" }, take: 10, include: { stock: true } }),
      prisma.week52Low.findMany({ where: idFilter("WEEK52_LOW") as any, orderBy: { ltp: "asc" }, take: 10, include: { stock: true } }),
      prisma.topGainer.findMany({ where: idFilter("TOP_GAINERS") as any, orderBy: [{ rank: "asc" }, { changePercent: "desc" }], take: 20, include: { stock: true } }),
      prisma.topLoser.findMany({ where: idFilter("TOP_LOSERS") as any, orderBy: [{ rank: "asc" }, { changePercent: "asc" }], take: 20, include: { stock: true } }),
      prisma.largeDeal.findMany({ where: idFilter("LARGE_DEALS") as any, orderBy: { quantityTraded: "desc" }, take: 12, include: { stock: true } }),
    ]);

    const watchlist = run
      ? await prisma.watchlistItem.findMany({
          where: { watchlist: { analysisRunId: run.id } },
          include: { stock: true, tradeSetup: true },
          orderBy: { rank: "asc" },
        })
      : [];

    let avoided: any[] = [];
    if (run) {
      const avoidSetups = await prisma.tradeSetup.findMany({ where: { analysisRunId: run.id, status: "AVOID" }, include: { stock: true }, take: 10 });
      avoided = avoidSetups.map((s) => ({ symbol: s.stock.symbol, reason: s.reason }));
    }

    const noTrade = run ? watchlist.length === 0 : false;

    res.json(
      toPlain({
        tradingDate: dateStr,
        marketStatus: marketStatus,
        completeness: comp,
        analysisType: run?.analysisType ?? null,
        analysisStatus: run?.status ?? null,
        sectionAnalysisType,
        sectionSnapshotVersion: latestEntries[0]?.version ?? null,
        sectionSnapshotCreatedAt,
        nextTradingDate: run?.id ? (await prisma.dailyWatchlist.findUnique({ where: { analysisRunId: run.id } }))?.nextTradingDate?.toISOString().slice(0, 10) : null,
        topCandidates,
        sections: {
          mostActiveVolume: maVol,
          mostActiveValue: maVal,
          volumeGainers: volGainers,
          week52High: w52h,
          week52Low: w52l,
          topGainers: topGainers,
          topLosers: topLosers,
          largeDeals: large,
          avoid: avoided,
          noTrade,
        },
        watchlist: watchlist.map((w) => ({
          rank: w.rank,
          symbol: w.stock.symbol,
          company: w.stock.companyName,
          score: w.score,
          status: w.status,
          setup: w.tradeSetup,
        })),
      })
    );
  }),

  candidates: asyncHandler(async (req: any, res: Response) => {
    const dateStr = (req.query.date as string) || toDateString(new Date());
    const date = new Date(dateStr + "T00:00:00");
    const limit = Number(req.query.limit) || 100;
    const run = await getLatestRun(date);
    if (!run) return res.json({ tradingDate: dateStr, candidates: [] });
    const scores = await prisma.dailyStockScore.findMany({
      where: { analysisRunId: run.id },
      include: { stock: true },
      orderBy: { rank: "asc" },
    });
    const setups = await prisma.tradeSetup.findMany({ where: { analysisRunId: run.id } });
    const setupMap = new Map(setups.map((s) => [s.stockId, s]));
    const metricMap = new Map(
      (await prisma.dailyStockMetric.findMany({ where: { tradingDate: date } })).map((m) => [m.stockId, m])
    );
    const candidates = scores.slice(0, limit).map((s: any) => {
      const st = setupMap.get(s.stockId);
      const m = metricMap.get(s.stockId);
      return {
        rank: s.rank,
        symbol: s.stock.symbol,
        company: s.stock.companyName,
        score: s.normalizedScore,
        classification: s.classification,
        changePercent: m?.changePercent ?? null,
        ltp: st?.currentPrice ?? m?.ltp ?? null,
        volumeRatio: m?.volumeRatio1w ?? null,
        turnover: m?.turnover ?? null,
        is52wHigh: m?.is52wHigh ?? false,
        status: st?.status ?? null,
        signals: s.signals,
        setup: st,
      };
    });
    res.json(toPlain({ tradingDate: dateStr, candidates }));
  }),

  candidateDetail: asyncHandler(async (req: any, res: Response) => {
    const symbol = (req.params.symbol as string).toUpperCase();
    const dateStr = (req.query.date as string) || toDateString(new Date());
    const date = new Date(dateStr + "T00:00:00");
    const stock = await prisma.stock.findUnique({ where: { symbol } });
    if (!stock) return res.status(404).json({ error: "Stock not found." });
    const run = await getLatestRun(date);
    const metric = await prisma.dailyStockMetric.findUnique({ where: { tradingDate_stockId: { tradingDate: date, stockId: stock.id } } });
    let score = null;
    let setup = null;
    if (run) {
      score = await prisma.dailyStockScore.findFirst({ where: { analysisRunId: run.id, stockId: stock.id } });
      setup = await prisma.tradeSetup.findFirst({ where: { analysisRunId: run.id, stockId: stock.id } });
    }
    // Source records
    const sources = {
      mostActiveVolume: await prisma.mostActiveVolume.findFirst({ where: { tradingDate: date, stockId: stock.id } }),
      mostActiveValue: await prisma.mostActiveValue.findFirst({ where: { tradingDate: date, stockId: stock.id } }),
      volumeGainer: await prisma.volumeGainer.findFirst({ where: { tradingDate: date, stockId: stock.id } }),
      week52High: await prisma.week52High.findFirst({ where: { tradingDate: date, stockId: stock.id } }),
      week52Low: await prisma.week52Low.findFirst({ where: { tradingDate: date, stockId: stock.id } }),
      topGainer: await prisma.topGainer.findFirst({ where: { tradingDate: date, stockId: stock.id } }),
      topLoser: await prisma.topLoser.findFirst({ where: { tradingDate: date, stockId: stock.id } }),
      largeDeals: await prisma.largeDeal.findMany({ where: { tradingDate: date, stockId: stock.id }, take: 50 }),
    };
    res.json(toPlain({ symbol, stock, metric, score, setup, sources }));
  }),

  watchlist: asyncHandler(async (req: any, res: Response) => {
    const dateStr = (req.query.date as string) || toDateString(new Date());
    const date = new Date(dateStr + "T00:00:00");
    const run = await getLatestRun(date);
    if (!run) return res.json({ tradingDate: dateStr, watchlist: null });
    const wl = await prisma.dailyWatchlist.findUnique({ where: { analysisRunId: run.id }, include: { items: { include: { stock: true, tradeSetup: true }, orderBy: { rank: "asc" } } } });
    res.json(toPlain({ tradingDate: dateStr, watchlist: wl }));
  }),

  history: asyncHandler(async (_req: any, res: Response) => {
    const days = await prisma.tradingDay.findMany({ orderBy: { tradingDate: "desc" }, take: 120 });
    const out = [];
    for (const d of days) {
      const comp = await completeness(d.tradingDate);
      // Enumerate every distinct snapshot (INTRADAY/EOD) so the user can open
      // each one separately in history.
      const snapshots = await listSnapshotsForDate(d.tradingDate);
      const runs = await prisma.analysisRun.findMany({
        where: { tradingDate: d.tradingDate },
        orderBy: { id: "desc" },
      });
      const snapshotsOut = snapshots.map((s) => {
        const run = runs.find((r) => (r.analysisType as string) === (s.analysisType as string));
        return {
          version: s.version,
          analysisType: s.analysisType,
          createdAt: s.createdAtISO,
          reportCount: s.reportCount,
          reportTypes: s.reportTypes,
          uploadIds: s.uploadIds,
          analysisStatus: run?.status ?? null,
          stocksAnalyzed: run?.stocksAnalyzed ?? 0,
          topCandidate: null,
        };
      });
      // Attach the top candidate for the latest run.
      const latestRun = runs[0];
      let topCandidate: any = null;
      if (latestRun) {
        const top = await prisma.dailyStockScore.findFirst({ where: { analysisRunId: latestRun.id }, orderBy: { rank: "asc" }, include: { stock: true } });
        if (top) topCandidate = { symbol: top.stock.symbol, score: top.normalizedScore };
        for (const s of snapshotsOut) {
          if ((s.analysisType as string) === (latestRun.analysisType as string)) s.topCandidate = topCandidate;
        }
      }
      out.push({
        tradingDate: toDateString(d.tradingDate),
        marketStatus: d.marketStatus,
        completeness: comp,
        analysisStatus: latestRun?.status ?? null,
        analysisType: latestRun?.analysisType ?? null,
        stocksAnalyzed: latestRun?.stocksAnalyzed ?? 0,
        topCandidate,
        snapshots: snapshotsOut,
        snapshotCount: snapshotsOut.length,
      });
    }
    res.json(toPlain({ history: out }));
  }),

  stockHistory: asyncHandler(async (req: any, res: Response) => {
    const symbol = (req.params.symbol as string).toUpperCase();
    const stock = await prisma.stock.findUnique({ where: { symbol } });
    if (!stock) return res.status(404).json({ error: "Stock not found." });
    const metrics = await prisma.dailyStockMetric.findMany({
      where: { stockId: stock.id },
      orderBy: { tradingDate: "desc" },
      include: { stock: true },
    });
    // attach scores
    const dates = metrics.map((m) => m.tradingDate);
    const runsByDate = await prisma.analysisRun.findMany({ where: { tradingDate: { in: dates } }, orderBy: { id: "desc" } });
    const runByDateMap = new Map(runsByDate.map((r) => [r.tradingDate.toISOString().slice(0, 10), r]));
    const history = [];
    for (const m of metrics) {
      const key = m.tradingDate.toISOString().slice(0, 10);
      const run = runByDateMap.get(key);
      let score = null;
      if (run) score = await prisma.dailyStockScore.findFirst({ where: { analysisRunId: run.id, stockId: stock.id } });
      history.push({
        tradingDate: key,
        ltp: m.ltp,
        changePercent: m.changePercent,
        volumeRatio: m.volumeRatio1w,
        is52wHigh: m.is52wHigh,
        is52wLow: m.is52wLow,
        score: score?.normalizedScore ?? null,
        classification: score?.classification ?? null,
        sourceCount: m.sourceCount,
      });
    }
    res.json(toPlain({ symbol, company: stock.companyName, history }));
  }),
};
