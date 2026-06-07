// Engine ke event payloads ka local mirror (shared package se aligned).
export interface UserContext {
  interests: string[];
  device: string;
  country: string;
  hourOfDay: number;
}

export interface AdRequest {
  slotSize: string;
  floorPrice: number;
  user: UserContext;
}

export interface Creative {
  id: string;
  title: string;
  imageUrl: string;
  landingUrl: string;
}

export interface BidResponse {
  bidderId: string;
  bidderName: string;
  status: "BID" | "NO_BID";
  price: number;
  predictedCtr: number;
  creative: Creative | null;
  reason?: string;
}

export interface AuctionResult {
  auctionId: string;
  winnerId: string | null;
  winnerName: string | null;
  clearingPrice: number;
  winningBid: number;
  creative: Creative | null;
  numBids: number;
  filled: boolean;
}

export interface BidRow {
  bidderId: string;
  bidderName: string;
  status: "BID" | "NO_BID" | "REJECTED";
  price: number;
  predictedCtr: number;
  latencyMs: number;
  reason?: string;
}

export interface BidderMetric {
  bidderId: string;
  bidderName: string;
  budgetRemaining: number;
  wins: number;
  spend: number;
}

export interface Metrics {
  totalAuctions: number;
  fillRate: number;
  avgLatencyMs: number;
  auctionsPerSec: number;
  bidders: BidderMetric[];
}
