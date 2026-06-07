import { BidRequest, BidResponse } from "@rtb/shared";
import { config } from "./config";
import { matchesTargeting } from "./targeting";
import { predictCtr } from "./mlClient";
import { getBudget } from "./redis";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function noBid(reason: string): BidResponse {
  return {
    bidderId: config.bidderId,
    bidderName: config.bidderName,
    adCategory: config.adCategory,
    status: "NO_BID",
    price: 0,
    predictedCtr: 0,
    creative: null,
    reason,
  };
}

/** Core decision: targeting -> budget -> CTR -> bid = pCTR * clickValue. */
export async function evaluate(req: BidRequest): Promise<BidResponse> {
  // Simulated think-time — 100ms race ko realistic banata hai.
  const latency = config.minLatencyMs + Math.random() * (config.maxLatencyMs - config.minLatencyMs);
  await sleep(latency);

  if (!matchesTargeting(req.user)) return noBid("TARGETING_MISS");

  const budget = await getBudget();
  if (budget < req.floorPrice) return noBid("INSUFFICIENT_BUDGET");

  const ctr = await predictCtr(req.user); // <-- yahan ML lagti hai
  // Private-value jitter (±15%): same category ke bidders ko thoda alag valuation deta hai,
  // warna highest clickValue wala hamesha jeet jata (winner vary kare isliye).
  const jitter = 0.85 + Math.random() * 0.3;
  let price = ctr * config.clickValue * jitter; // bid ≈ predictedCTR * clickValue
  price = Math.min(price, budget); // budget se zyada bid mat karo

  if (price < req.floorPrice) return noBid("BELOW_FLOOR");

  return {
    bidderId: config.bidderId,
    bidderName: config.bidderName,
    adCategory: config.adCategory,
    status: "BID",
    price: Number(price.toFixed(2)),
    predictedCtr: Number(ctr.toFixed(4)),
    creative: config.creative,
  };
}
