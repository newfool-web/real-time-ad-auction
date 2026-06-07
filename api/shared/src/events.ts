// Socket.IO event contracts — dashboard inhi ko sunta hai.

export const SOCKET_EVENTS = {
  AUCTION_START: "auction:start",
  BID_RECEIVED: "bid:received",
  BID_REJECTED: "bid:rejected", // late ya invalid bid
  AUCTION_WON: "auction:won",
  AUCTION_NO_FILL: "auction:no-fill",
  METRICS_UPDATE: "metrics:update",
} as const;

/** Engine -> metrics broadcast (har second). */
export interface MetricsUpdateEvent {
  totalAuctions: number;
  fillRate: number; // %
  avgLatencyMs: number;
  auctionsPerSec: number;
  bidders: Array<{
    bidderId: string;
    bidderName: string;
    budgetRemaining: number;
    wins: number;
    spend: number;
  }>;
}
