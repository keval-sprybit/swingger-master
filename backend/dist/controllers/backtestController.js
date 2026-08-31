import { asyncHandler } from "../middleware/error.js";
import { runBacktestForRange, listBacktestRuns, getBacktestRun } from "../services/backtestService.js";
import { toPlain } from "../utils/serialize.js";
export const backtestController = {
    run: asyncHandler(async (req, res) => {
        const { from, to, mode, label } = req.body ?? {};
        const m = mode === "INTRADAY" ? "INTRADAY" : "SWING";
        if (!from || !to)
            return res.status(400).json({ error: "from and to dates are required." });
        try {
            const result = await runBacktestForRange(from, to, m, label);
            res.json(toPlain(result));
        }
        catch (err) {
            res.status(400).json({ error: String(err?.message ?? err) });
        }
    }),
    list: asyncHandler(async (_req, res) => {
        const runs = await listBacktestRuns();
        res.json(toPlain({ runs }));
    }),
    get: asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        const run = await getBacktestRun(id);
        if (!run)
            return res.status(404).json({ error: "Backtest run not found." });
        res.json(toPlain(run));
    }),
};
//# sourceMappingURL=backtestController.js.map