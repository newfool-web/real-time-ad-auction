// Budget Redis me rehta hai — atomic deduction engine karta hai, yahan sirf read.
import Redis from "ioredis";
import { config } from "./config";
import { logger } from "./logger";

export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

redis.on("error", (err) => logger.error({ err }, "redis error"));

const BUDGET_KEY = `budget:${config.bidderId}`;

/** Startup pe budget seed karo (sirf agar set na ho). */
export async function initBudget(): Promise<void> {
  const exists = await redis.exists(BUDGET_KEY);
  if (!exists) {
    await redis.set(BUDGET_KEY, config.initialBudget.toFixed(2));
    logger.info({ budget: config.initialBudget }, "budget seeded");
  }
}

export async function getBudget(): Promise<number> {
  const v = await redis.get(BUDGET_KEY);
  return v ? Number(v) : 0;
}
