import { asyncHandler } from "../middleware/error.js";
import { listPaperTrades, createPaperTrade, updatePaperTrade, computePaperTradeStats, getPaperTrade, } from "../repositories/paperTrades.js";
import { toPlain } from "../utils/serialize.js";
import { z } from "zod";
const createSchema = z.object({
    stockId: z.number().int().positive(),
    symbol: z.string().min(1),
    entryDate: z.string().min(1),
    entryPrice: z.number().positive(),
    stopLoss: z.number().positive(),
    target1: z.number().positive().optional().nullable(),
    target2: z.number().positive().optional().nullable(),
    quantity: z.number().int().positive(),
    exitDate: z.string().optional().nullable(),
    exitPrice: z.number().positive().optional().nullable(),
    result: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
});
export const paperTradeController = {
    list: asyncHandler(async (_req, res) => {
        const [trades, stats] = await Promise.all([listPaperTrades(), computePaperTradeStats()]);
        res.json(toPlain({ trades, stats }));
    }),
    create: asyncHandler(async (req, res) => {
        const parsed = createSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: "Invalid paper trade", detail: parsed.error.message });
        const d = parsed.data;
        const created = await createPaperTrade({
            ...d,
            entryDate: new Date(d.entryDate),
            exitDate: d.exitDate ? new Date(d.exitDate) : null,
        });
        res.json(toPlain(created));
    }),
    update: asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        const parsed = createSchema.partial().safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: "Invalid paper trade", detail: parsed.error.message });
        const d = parsed.data;
        const updated = await updatePaperTrade(id, {
            ...d,
            entryDate: d.entryDate ? new Date(d.entryDate) : undefined,
            exitDate: d.exitDate ? new Date(d.exitDate) : undefined,
        });
        res.json(toPlain(updated));
    }),
    get: asyncHandler(async (req, res) => {
        const t = await getPaperTrade(Number(req.params.id));
        if (!t)
            return res.status(404).json({ error: "Not found" });
        res.json(toPlain(t));
    }),
};
//# sourceMappingURL=paperTradeController.js.map