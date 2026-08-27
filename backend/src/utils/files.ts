import crypto from "crypto";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { config } from "../config/index.js";

export function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

// Remove path traversal and unsafe characters from user-supplied filenames.
export function sanitizeFilename(name: string): string {
  const base = path.basename(name);
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 120 ? cleaned.slice(0, 120) : cleaned;
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

// Store the raw CSV under uploads/YYYY/MM/DD/ and return the stored relative path + absolute dir.
export async function storeRawFile(
  buffer: Buffer,
  originalName: string,
  tradingDate: Date
): Promise<{ storedFilename: string; relativePath: string; absolutePath: string }> {
  const sub = `${tradingDate.getFullYear()}/${String(tradingDate.getMonth() + 1).padStart(2, "0")}/${String(
    tradingDate.getDate()
  ).padStart(2, "0")}`;
  const dir = path.join(config.uploadDir, sub);
  await ensureDir(dir);
  const safe = sanitizeFilename(originalName);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const storedFilename = `${stamp}__${safe}`;
  const absolutePath = path.join(dir, storedFilename);
  await fs.writeFile(absolutePath, buffer);
  return { storedFilename, relativePath: path.join(sub, storedFilename), absolutePath };
}
