// Redis: per-bidder budgets aur stats (read for metrics; direct-mode me pace bhi).
import Redis from "ioredis";
import { config } from "./config";
import { logger } from "./logger";

export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

redis.on("error", (err) => logger.error({ err }, "redis error"));

export async function getBudget(bidderId: string): Promise<number> {
  const v = await redis.get(`budget:${bidderId}`);
  return v ? Number(v) : 0;
}

export async function getStats(bidderId: string): Promise<{ wins: number; spend: number }> {
  const h = await redis.hgetall(`stats:${bidderId}`);
  return { wins: Number(h.wins ?? 0), spend: Number(h.spend ?? 0) };
}

/** DIRECT mode: budget deduct + win/spend stats (Kafka mode me pacing-service karta hai). */
export async function paceBudget(bidderId: string, price: number): Promise<void> {
  await redis.incrbyfloat(`budget:${bidderId}`, -price);
  await redis.hincrby(`stats:${bidderId}`, "wins", 1);
  await redis.hincrbyfloat(`stats:${bidderId}`, "spend", price);
}
