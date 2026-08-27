import { Response } from "express";
import { asyncHandler } from "../middleware/error.js";
import { getSettings, updateSettings } from "../repositories/settings.js";
import { toPlain } from "../utils/serialize.js";
import { z } from "zod";

const settingsSchema = z.object({
  capital: z.number().positive().optional(),
  riskPercent: z.number().positive().max(100).optional(),
  minRiskReward: z.number().positive().optional(),
  maxWatchlistSize: z.number().int().positive().max(50).optional(),
});

export const settingsController = {
  get: asyncHandler(async (_req: any, res: Response) => {
    res.json(await getSettings());
  }),
  update: asyncHandler(async (req: any, res: Response) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid settings", detail: parsed.error.message });
    res.json(await updateSettings(parsed.data));
  }),
};
