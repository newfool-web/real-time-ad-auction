// In-memory rolling metrics + periodic broadcast to dashboard.
import { MetricsUpdateEvent, SOCKET_EVENTS } from "@rtb/shared";
import { config } from "./config";
import { getBudget, getStats } from "./redis";
import { Emit } from "./auction";

const state = {
  totalAuctions: 0,
  filled: 0,
  latencySum: 0,
  latencySamples: 0,
  windowCount: 0, // auctions in current 1s window
  lastRate: 0,
};

export function recordAuction(filled: boolean, latencyMs: number): void {
  state.totalAuctions++;
  state.windowCount++;
  if (filled) state.filled++;
  state.latencySum += latencyMs;
  state.latencySamples++;
}

export async function buildMetrics(): Promise<MetricsUpdateEvent> {
  const bidders = await Promise.all(
    config.bidders.map(async (b) => {
      const [budget, stats] = await Promise.all([getBudget(b.bidderId), getStats(b.bidderId)]);
      return {
        bidderId: b.bidderId,
        bidderName: b.name,
        budgetRemaining: Number(budget.toFixed(2)),
        wins: stats.wins,
        spend: Number(stats.spend.toFixed(2)),
      };
    })
  );
  return {
    totalAuctions: state.totalAuctions,
    fillRate: state.totalAuctions ? Number(((state.filled / state.totalAuctions) * 100).toFixed(1)) : 0,
    avgLatencyMs: state.latencySamples ? Number((state.latencySum / state.latencySamples).toFixed(1)) : 0,
    auctionsPerSec: state.lastRate,
    bidders,
  };
}

/** Har second metrics broadcast + rate window reset. */
export function startMetricsLoop(emit: Emit): void {
  setInterval(async () => {
    state.lastRate = state.windowCount;
    state.windowCount = 0;
    emit(SOCKET_EVENTS.METRICS_UPDATE, await buildMetrics());
  }, 1000);
}
