// Har bidder instance env se apni personality leta hai (config-driven, DRY).
import { Creative } from "@rtb/shared";

function num(key: string, def: number): number {
  const v = process.env[key];
  return v === undefined ? def : Number(v);
}

export const config = {
  port: num("PORT", 5001),
  bidderId: process.env.BIDDER_ID ?? "bidder-generic",
  bidderName: process.env.BIDDER_NAME ?? "Generic Bidder",
  adCategory: process.env.AD_CATEGORY ?? "generic",
  // Targeting: in interests me se koi ek match hona chahiye. Empty = sabko target karo.
  targetInterests: (process.env.TARGET_INTERESTS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  clickValue: num("CLICK_VALUE", 3.0), // ek click ki value ($)
  initialBudget: num("INITIAL_BUDGET", 40),
  // Simulated think-time taaki 100ms race realistic lage. ML call ~10-20ms add
  // karta hai, isliye headroom rakha hai (warna har koi timeout ho jata hai).
  minLatencyMs: num("MIN_LATENCY_MS", 5),
  maxLatencyMs: num("MAX_LATENCY_MS", 55),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  mlServiceUrl: process.env.ML_SERVICE_URL ?? "http://localhost:8000",
  creative: {
    id: process.env.CREATIVE_ID ?? "cr-generic",
    title: process.env.CREATIVE_TITLE ?? "Buy Now",
    imageUrl: process.env.CREATIVE_IMAGE ?? "https://via.placeholder.com/300x250",
    landingUrl: process.env.CREATIVE_LANDING ?? "https://example.com",
  } as Creative,
};
