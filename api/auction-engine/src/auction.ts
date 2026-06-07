// Auction core: fan-out -> collect -> rank (MaxHeap) -> second-price -> deduct.
import { randomUUID } from "crypto";
import {
  AdRequest,
  AuctionResult,
  BidRequest,
  BidResponse,
  MaxHeap,
  SOCKET_EVENTS,
} from "@rtb/shared";
import { config } from "./config";
import { logger } from "./logger";
import { fanOut } from "./bidderClient";
import { Emit, onAuctionCompleted, onFeedback } from "./effects";
import { simulateClick } from "./feedback";

export type { Emit };

export async function runAuction(adReq: AdRequest, emit: Emit): Promise<AuctionResult> {
  const auctionId = randomUUID().slice(0, 8);
  const ts = Date.now();

  emit(SOCKET_EVENTS.AUCTION_START, { auctionId, request: adReq, timeoutMs: config.timeoutMs, ts });

  const bidReq: BidRequest = {
    auctionId,
    slotSize: adReq.slotSize,
    floorPrice: adReq.floorPrice,
    user: adReq.user,
  };

  // 1. Concurrent fan-out with 100ms deadline.
  const outcomes = await fanOut(config.bidders, bidReq);

  // 2. MaxHeap me sirf valid bids (BID + price >= floor) daalo. Baaki reject events.
  const heap = new MaxHeap<BidResponse>((a, b) => a.price - b.price);
  let validBids = 0;

  for (const o of outcomes) {
    if (o.rejected) {
      emit(SOCKET_EVENTS.BID_REJECTED, {
        auctionId,
        bidderId: o.bidderId,
        bidderName: o.bidderId,
        reason: o.rejected,
        latencyMs: o.latencyMs,
        ts: Date.now(),
      });
      continue;
    }
    const bid = o.bid!;
    emit(SOCKET_EVENTS.BID_RECEIVED, { auctionId, bid, latencyMs: o.latencyMs, ts: Date.now() });

    if (bid.status === "BID" && bid.price >= adReq.floorPrice) {
      heap.push(bid);
      validBids++;
    } else if (bid.status === "BID") {
      emit(SOCKET_EVENTS.BID_REJECTED, {
        auctionId,
        bidderId: bid.bidderId,
        bidderName: bid.bidderName,
        reason: "BELOW_FLOOR",
        latencyMs: o.latencyMs,
        ts: Date.now(),
      });
    }
  }

  // 3. Winner select + second-price (pure decision — budget hot path me nahi).
  //    Budget pacing async hai: pacing-service stream se deduct karta hai.
  const { result, winnerCategory } = settle(auctionId, adReq, heap, validBids);

  if (result.filled && result.winnerId) {
    emit(SOCKET_EVENTS.AUCTION_WON, { auctionId, result, ts: Date.now() });
    // Phase 4: impression dikhi -> click simulate karo -> feedback (Kafka ya direct HTTP).
    const clicked = simulateClick(adReq.user, winnerCategory ?? "generic");
    onFeedback({
      features: {
        interests: adReq.user.interests,
        device: adReq.user.device,
        country: adReq.user.country,
        hourOfDay: adReq.user.hourOfDay,
        adCategory: winnerCategory ?? "generic",
      },
      clicked,
    });
  } else {
    emit(SOCKET_EVENTS.AUCTION_NO_FILL, { auctionId, ts: Date.now() });
  }

  // Completed auction -> history + budget pacing (Kafka consumers ya direct).
  onAuctionCompleted({ auctionId, slot: adReq.slotSize, floor: adReq.floorPrice, result });

  logger.info({ auctionId, winner: result.winnerId, price: result.clearingPrice, validBids }, "auction done");
  return result;
}

function settle(
  auctionId: string,
  adReq: AdRequest,
  heap: MaxHeap<BidResponse>,
  numBids: number
): { result: AuctionResult; winnerCategory: string | null } {
  const noFill: AuctionResult = {
    auctionId,
    winnerId: null,
    winnerName: null,
    clearingPrice: 0,
    winningBid: 0,
    creative: null,
    numBids,
    filled: false,
  };

  const winner = heap.pop(); // sabse high bid
  if (!winner) return { result: noFill, winnerCategory: null };

  const runnerUp = heap.peek(); // second highest
  // Second-price: runner-up + 0.01, agar koi second nahi to floor price.
  const clearingPrice = Number(((runnerUp ? runnerUp.price : adReq.floorPrice) + 0.01).toFixed(2));

  return {
    result: {
      auctionId,
      winnerId: winner.bidderId,
      winnerName: winner.bidderName,
      clearingPrice,
      winningBid: winner.price,
      creative: winner.creative,
      numBids,
      filled: true,
    },
    winnerCategory: winner.adCategory,
  };
}
