import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { GATEWAY_URL } from "../api";
import { AdRequest, AuctionResult, BidResponse, BidRow, Metrics } from "../types";

const EVT = {
  AUCTION_START: "auction:start",
  BID_RECEIVED: "bid:received",
  BID_REJECTED: "bid:rejected",
  AUCTION_WON: "auction:won",
  AUCTION_NO_FILL: "auction:no-fill",
  METRICS_UPDATE: "metrics:update",
};

export interface AuctionView {
  auctionId: string;
  timeoutMs: number;
  request: AdRequest | null;
  bids: BidRow[];
  result: AuctionResult | null;
}

export function useAuctionSocket() {
  const [connected, setConnected] = useState(false);
  const [current, setCurrent] = useState<AuctionView | null>(null);
  const [winningCreative, setWinningCreative] = useState<AuctionResult | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [winHistory, setWinHistory] = useState<{ t: number; price: number; latency: number }[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(GATEWAY_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on(EVT.AUCTION_START, (e: { auctionId: string; timeoutMs: number; request: AdRequest }) => {
      // Naya auction shuru — flow reset.
      setCurrent({ auctionId: e.auctionId, timeoutMs: e.timeoutMs, request: e.request, bids: [], result: null });
    });

    socket.on(EVT.BID_RECEIVED, (e: { auctionId: string; bid: BidResponse; latencyMs: number }) => {
      setCurrent((c) => {
        if (!c || c.auctionId !== e.auctionId) return c;
        const row: BidRow = {
          bidderId: e.bid.bidderId,
          bidderName: e.bid.bidderName,
          status: e.bid.status,
          price: e.bid.price,
          predictedCtr: e.bid.predictedCtr,
          latencyMs: e.latencyMs,
          reason: e.bid.reason,
        };
        return { ...c, bids: [...c.bids, row] };
      });
    });

    socket.on(
      EVT.BID_REJECTED,
      (e: { auctionId: string; bidderId: string; bidderName: string; reason: string; latencyMs: number }) => {
        setCurrent((c) => {
          if (!c || c.auctionId !== e.auctionId) return c;
          const row: BidRow = {
            bidderId: e.bidderId,
            bidderName: e.bidderName,
            status: "REJECTED",
            price: 0,
            predictedCtr: 0,
            latencyMs: e.latencyMs,
            reason: e.reason,
          };
          return { ...c, bids: [...c.bids, row] };
        });
      }
    );

    socket.on(EVT.AUCTION_WON, (e: { auctionId: string; result: AuctionResult }) => {
      setCurrent((c) => (c && c.auctionId === e.auctionId ? { ...c, result: e.result } : c));
      setWinningCreative(e.result);
      setWinHistory((h) =>
        [...h, { t: Date.now(), price: e.result.clearingPrice, latency: 0 }].slice(-30)
      );
    });

    socket.on(EVT.METRICS_UPDATE, (m: Metrics) => setMetrics(m));

    return () => {
      socket.disconnect();
    };
  }, []);

  return { connected, current, winningCreative, metrics, winHistory };
}
