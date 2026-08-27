import { prisma } from "../prisma.js";

export async function upsertStock(
  symbol: string,
  extra?: { companyName?: string | null; series?: string | null; isin?: string | null }
): Promise<number> {
  const sym = symbol.toUpperCase().trim();
  const existing = await prisma.stock.findUnique({ where: { symbol: sym }, select: { id: true } });
  if (existing) {
    if (extra && (extra.companyName || extra.series)) {
      await prisma.stock.update({
        where: { id: existing.id },
        data: {
          ...(extra.companyName ? { companyName: extra.companyName } : {}),
          ...(extra.series ? { series: extra.series } : {}),
        },
      });
    }
    return existing.id;
  }
  const created = await prisma.stock.create({
    data: {
      symbol: sym,
      companyName: extra?.companyName ?? null,
      series: extra?.series ?? "EQ",
      isin: extra?.isin ?? null,
    },
    select: { id: true },
  });
  return created.id;
}

export async function getStockId(symbol: string): Promise<number | null> {
  const s = await prisma.stock.findUnique({ where: { symbol: symbol.toUpperCase().trim() }, select: { id: true } });
  return s?.id ?? null;
}
