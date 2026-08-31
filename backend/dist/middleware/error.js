import { config } from "../config/index.js";
export class ApiError extends Error {
    status;
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}
export function errorHandler(err, _req, res, _next) {
    if (err instanceof ApiError) {
        return res.status(err.status).json({ error: err.message });
    }
    if (err?.code === "P2002") {
        return res.status(409).json({ error: "Duplicate record.", detail: err.message });
    }
    console.error("[ERROR]", err);
    return res.status(500).json({ error: "Internal server error", detail: err?.message ?? String(err) });
}
export function notFound(_req, res) {
    res.status(404).json({ error: "Not found" });
}
export function asyncHandler(fn) {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
}
export const uploadLimits = {
    fileSize: config.maxUploadBytes,
    files: 50,
};
//# sourceMappingURL=error.js.map