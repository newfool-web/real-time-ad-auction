// Core domain types — saare services inhi contracts pe depend karte hain.

/** User + page context jo ad request ke saath aata hai. */
export interface UserContext {
  interests: string[]; // e.g. ["sports", "travel"]
  device: "mobile" | "desktop" | "tablet";
  country: string; // ISO code, e.g. "IN"
  hourOfDay: number; // 0-23
}

/** Publisher se aane wala ad request. */
export interface AdRequest {
  slotSize: string; // e.g. "300x250"
  floorPrice: number; // minimum acceptable bid
  user: UserContext;
}

/** Engine -> bidder ko bheja jane wala bid request. */
export interface BidRequest {
  auctionId: string;
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

/** Bidder ka response — ya to bid, ya NO_BID. */
export interface BidResponse {
  bidderId: string;
  bidderName: string;
  adCategory: string; // feedback/ML loop ke features ke liye
  status: "BID" | "NO_BID";
  price: number; // 0 if NO_BID
  predictedCtr: number; // model ka output, 0 if NO_BID
  creative: Creative | null;
  reason?: string; // NO_BID ki wajah (targeting/budget/floor)
}

/** Auction ke baad ka final result. */
export interface AuctionResult {
  auctionId: string;
  winnerId: string | null;
  winnerName: string | null;
  clearingPrice: number; // second price + 0.01
  winningBid: number; // winner ne actually kitna bid kiya
  creative: Creative | null;
  numBids: number;
  filled: boolean;
}

/** ML service /predict response (bidder isse pCTR leta hai). */
export interface PredictResponse {
  ctr: number;
}
