import { prisma } from "../prisma.js";

export interface PaperTradeInput {
  stockId: number;
  symbol: string;
  entryDate: Date;
  entryPrice: number;
  stopLoss: number;
  target1?: number | null;
  target2?: number | null;
  quantity: number;
  exitDate?: Date | null;
  exitPrice?: number | null;
  result?: string | null;
  notes?: string | null;
}

export async function createPaperTrade(input: PaperTradeInput) {
  let profitLoss: number | null = null;
  if (input.exitPrice !== undefined && input.exitPrice !== null) {
    profitLoss = (input.exitPrice - input.entryPrice) * input.quantity;
  }
  return prisma.paperTrade.create({
    data: {
      stockId: input.stockId,
      symbol: input.symbol,
      entryDate: input.entryDate,
      entryPrice: input.entryPrice,
      stopLoss: input.stopLoss,
      target1: input.target1 ?? null,
      target2: input.target2 ?? null,
      quantity: input.quantity,
      exitDate: input.exitDate ?? null,
      exitPrice: input.exitPrice ?? null,
      result: input.result ?? null,
      notes: input.notes ?? null,
      profitLoss,
    },
  });
}

export async function updatePaperTrade(id: number, input: Partial<PaperTradeInput>) {
  const data: any = { ...input, updatedAt: new Date() };
  if (input.exitPrice !== undefined && input.exitPrice !== null && input.entryPrice !== undefined && input.quantity !== undefined) {
    data.profitLoss = (input.exitPrice - input.entryPrice) * input.quantity;
  }
  return prisma.paperTrade.update({ where: { id }, data });
}

export async function listPaperTrades() {
  return prisma.paperTrade.findMany({ orderBy: { entryDate: "desc" }, take: 500 });
}

export async function getPaperTrade(id: number) {
  return prisma.paperTrade.findUnique({ where: { id } });
}

export interface PaperTradeStats {
  total: number;
  wins: number;
  losses: number;
  open: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  profitFactor: number;
  totalPL: number;
  maxDrawdown: number;
}

export async function computePaperTradeStats(): Promise<PaperTradeStats> {
  const trades = await prisma.paperTrade.findMany();
  let wins = 0;
  let losses = 0;
  let open = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalPL = 0;
  let peak = 0;
  let maxDD = 0;
  let running = 0;
  for (const t of trades) {
    const pl = t.profitLoss ? Number(t.profitLoss) : null;
    if (pl === null) {
      open++;
      continue;
    }
    totalPL += pl;
    running += pl;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
    if (pl >= 0) {
      wins++;
      grossProfit += pl;
    } else {
      losses++;
      grossLoss += Math.abs(pl);
    }
  }
  const closed = wins + losses;
  const winRate = closed > 0 ? (wins / closed) * 100 : 0;
  const avgProfit = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  return {
    total: trades.length,
    wins,
    losses,
    open,
    winRate: Math.round(winRate * 100) / 100,
    avgProfit: Math.round(avgProfit * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: Number.isFinite(profitFactor) ? Math.round(profitFactor * 100) / 100 : profitFactor,
    totalPL: Math.round(totalPL * 100) / 100,
    maxDrawdown: Math.round(maxDD * 100) / 100,
  };
}
