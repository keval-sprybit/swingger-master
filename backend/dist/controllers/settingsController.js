import { asyncHandler } from "../middleware/error.js";
import { getSettings, updateSettings } from "../repositories/settings.js";
import { z } from "zod";
const settingsSchema = z.object({
    capital: z.number().positive().optional(),
    riskPercent: z.number().positive().max(100).optional(),
    minRiskReward: z.number().positive().optional(),
    maxWatchlistSize: z.number().int().positive().max(50).optional(),
});
export const settingsController = {
    get: asyncHandler(async (_req, res) => {
        res.json(await getSettings());
    }),
    update: asyncHandler(async (req, res) => {
        const parsed = settingsSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: "Invalid settings", detail: parsed.error.message });
        res.json(await updateSettings(parsed.data));
    }),
};
//# sourceMappingURL=settingsController.js.map