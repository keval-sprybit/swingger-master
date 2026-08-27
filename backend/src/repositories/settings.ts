import { prisma } from "../prisma.js";
import { config } from "../config/index.js";

export interface AppSettings {
  capital: number;
  riskPercent: number;
  minRiskReward: number;
  maxWatchlistSize: number;
}

const DEFAULTS: AppSettings = {
  capital: config.defaultCapital,
  riskPercent: config.defaultRiskPercent,
  minRiskReward: config.minRiskReward,
  maxWatchlistSize: config.maxWatchlistSize,
};

const KEYS: Record<keyof AppSettings, { key: string; type: "number" | "string" }> = {
  capital: { key: "DEFAULT_CAPITAL", type: "number" },
  riskPercent: { key: "DEFAULT_RISK_PERCENT", type: "number" },
  minRiskReward: { key: "MIN_RISK_REWARD", type: "number" },
  maxWatchlistSize: { key: "MAX_WATCHLIST_SIZE", type: "number" },
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.systemSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const result: AppSettings = { ...DEFAULTS };
  (Object.keys(KEYS) as (keyof AppSettings)[]).forEach((k) => {
    const def = KEYS[k];
    const v = map.get(def.key);
    if (v !== undefined) {
      const parsed = def.type === "number" ? Number(v) : v;
      if (def.type === "number" && Number.isFinite(parsed as number)) {
        (result[k] as number) = parsed as number;
      } else if (def.type === "string") {
        (result[k] as any) = parsed;
      }
    }
  });
  return result;
}

export async function updateSettings(input: Partial<AppSettings>): Promise<AppSettings> {
  for (const k of Object.keys(input) as (keyof AppSettings)[]) {
    const def = KEYS[k];
    const value = input[k];
    if (value === undefined) continue;
    await prisma.systemSetting.upsert({
      where: { key: def.key },
      update: { value: String(value), updatedAt: new Date() },
      create: {
        key: def.key,
        value: String(value),
        valueType: def.type,
        description: defaultDescription(def.key),
      },
    });
  }
  return getSettings();
}

function defaultDescription(key: string): string {
  switch (key) {
    case "DEFAULT_CAPITAL":
      return "Default capital per trade (₹)";
    case "DEFAULT_RISK_PERCENT":
      return "Default risk per trade (%)";
    case "MIN_RISK_REWARD":
      return "Minimum acceptable risk/reward ratio";
    case "MAX_WATCHLIST_SIZE":
      return "Maximum number of stocks in the next-session watchlist";
    default:
      return "";
  }
}

// Ensure default settings rows exist (safe to call on startup).
export async function seedSettings(): Promise<void> {
  const existing = await prisma.systemSetting.count();
  if (existing === 0) {
    await prisma.systemSetting.createMany({
      data: [
        { key: "DEFAULT_CAPITAL", value: String(DEFAULTS.capital), valueType: "number", description: defaultDescription("DEFAULT_CAPITAL") },
        { key: "DEFAULT_RISK_PERCENT", value: String(DEFAULTS.riskPercent), valueType: "number", description: defaultDescription("DEFAULT_RISK_PERCENT") },
        { key: "MIN_RISK_REWARD", value: String(DEFAULTS.minRiskReward), valueType: "number", description: defaultDescription("MIN_RISK_REWARD") },
        { key: "MAX_WATCHLIST_SIZE", value: String(DEFAULTS.maxWatchlistSize), valueType: "number", description: defaultDescription("MAX_WATCHLIST_SIZE") },
      ],
    });
  }
}
