import { Response } from "express";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { runAnalysis } from "../services/analysisService.js";
import { toPlain } from "../utils/serialize.js";
import { toDateString } from "../utils/date.js";
import { REQUIRED_REPORTS } from "../config/index.js";
import { ensureTradingDay } from "../repositories/metrics.js";

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

    // Sections
    const [maVol, volGainers, w52h, large] = await Promise.all([
      prisma.mostActiveVolume.findMany({ where: { tradingDate: date }, orderBy: { volume: "desc" }, take: 10, include: { stock: true } }),
      prisma.volumeGainer.findMany({ where: { tradingDate: date }, orderBy: { volumeRatio1w: "desc" }, take: 10, include: { stock: true } }),
      prisma.week52High.findMany({ where: { tradingDate: date }, orderBy: { ltp: "desc" }, take: 20, include: { stock: true } }),
      prisma.largeDeal.findMany({ where: { tradingDate: date }, orderBy: { quantityTraded: "desc" }, take: 30, include: { stock: true } }),
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
        marketStatus: marketStatusNow(),
        completeness: comp,
        analysisType: run?.analysisType ?? null,
        analysisStatus: run?.status ?? null,
        nextTradingDate: run?.id ? (await prisma.dailyWatchlist.findUnique({ where: { analysisRunId: run.id } }))?.nextTradingDate?.toISOString().slice(0, 10) : null,
        topCandidates,
        sections: {
          mostActiveVolume: maVol,
          volumeGainers: volGainers,
          week52High: w52h,
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
      const run = await getLatestRun(d.tradingDate);
      let topCandidate: any = null;
      if (run) {
        const top = await prisma.dailyStockScore.findFirst({ where: { analysisRunId: run.id }, orderBy: { rank: "asc" }, include: { stock: true } });
        if (top) topCandidate = { symbol: top.stock.symbol, score: top.normalizedScore };
      }
      out.push({
        tradingDate: toDateString(d.tradingDate),
        marketStatus: d.marketStatus,
        completeness: comp,
        analysisStatus: run?.status ?? null,
        stocksAnalyzed: run?.stocksAnalyzed ?? 0,
        topCandidate,
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
