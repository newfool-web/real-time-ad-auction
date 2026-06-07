// Fan-out: saare bidders ko EK SAATH request bhejo, 100ms ka hard deadline lagao.
// Promise.allSettled + AbortController = concurrent collection + timeout rejection.
import axios from "axios";
import { BidRequest, BidResponse } from "@rtb/shared";
import { BidderEndpoint, config } from "./config";
import { logger } from "./logger";

export interface BidOutcome {
  bidderId: string;
  latencyMs: number;
  bid?: BidResponse; // time pe aaya valid response
  rejected?: "TIMEOUT" | "ERROR"; // late ya fail
}

async function callBidder(b: BidderEndpoint, req: BidRequest): Promise<BidOutcome> {
  const start = Date.now();
  const controller = new AbortController();
  // Deadline ke baad request abort — late bid discard.
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const { data } = await axios.post<BidResponse>(`${b.url}/bid`, req, {
      signal: controller.signal,
      timeout: config.timeoutMs,
    });
    clearTimeout(timer);
    return { bidderId: b.bidderId, latencyMs: Date.now() - start, bid: data };
  } catch (err) {
    clearTimeout(timer);
    const latencyMs = Date.now() - start;
    const isTimeout = controller.signal.aborted || (err as any)?.code === "ECONNABORTED";
    logger.debug({ bidderId: b.bidderId, latencyMs, isTimeout }, "bidder call failed");
    return { bidderId: b.bidderId, latencyMs, rejected: isTimeout ? "TIMEOUT" : "ERROR" };
  }
}

/** Saare bidders ko parallel me call karo; sab settle hone ka wait. */
export async function fanOut(bidders: BidderEndpoint[], req: BidRequest): Promise<BidOutcome[]> {
  const settled = await Promise.allSettled(bidders.map((b) => callBidder(b, req)));
  return settled.map((s) =>
    s.status === "fulfilled" ? s.value : { bidderId: "unknown", latencyMs: config.timeoutMs, rejected: "ERROR" }
  );
}
