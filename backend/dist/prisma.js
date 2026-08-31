import { PrismaClient } from "@prisma/client";
export const prisma = global.__prisma ??
    new PrismaClient({
        log: process.env.PRISMA_LOG === "true" ? ["query", "error", "warn"] : ["error"],
    });
if (process.env.NODE_ENV !== "production") {
    global.__prisma = prisma;
}
//# sourceMappingURL=prisma.js.map