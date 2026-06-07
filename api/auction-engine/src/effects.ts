// Effects seam — yahi decide karta hai ki side-effects Kafka se jayein (LOCAL, full
// architecture) ya engine khud direct kare (PROD/A1, no Kafka/consumers).
//
//   USE_KAFKA=true  (default): publish to topics -> consumers handle (UNCHANGED behaviour).
//   USE_KAFKA=false (A1 prod): engine directly -> Socket.IO + Postgres + Redis + ML HTTP.
//
// Auction code in dono cases ek hi interface use karta hai; sirf yahan branch hai.
import axios from "axios";
import { AuctionResult } from "@rtb/shared";
import { config } from "./config";
import { logger } from "./logger";
import { initKafka, publish, TOPICS } from "./kafka";
import * as directEffects from "./directEffects";

export type Emit = (event: string, payload: unknown) => void;

export interface CompletedAuction {
  auctionId: string;
  slot: string;
  floor: number;
  result: AuctionResult;
}

export interface Feedback {
  features: {
    interests: string[];
    device: string;
    country: string;
    hourOfDay: number;
    adCategory: string;
  };
  clicked: 0 | 1;
}

import { Server as HttpServer } from "http";

export async function initEffects(httpServer: HttpServer): Promise<Emit> {
  if (config.useKafka) {
    // LOCAL: bilkul pehle jaisa — events ui-events topic pe.
    await initKafka();
    logger.info("effects: KAFKA mode");
    return (event, payload) => publish(TOPICS.UI, { event, payload });
  }
  // PROD/A1: engine khud sab karta hai (Socket.IO + Postgres + Redis).
  await directEffects.initDirect(httpServer);
  logger.info("effects: DIRECT mode (no kafka)");
  return (event, payload) => directEffects.emitDirect(event, payload);
}

/** Auction complete hone par: history + budget pacing. */
export function onAuctionCompleted(c: CompletedAuction): void {
  if (config.useKafka) {
    publish(TOPICS.AUCTION, { type: "auction-completed", ...c, ts: Date.now() });
  } else {
    directEffects.persistAndPace(c);
  }
}

/** Winning impression ka click feedback -> ML retraining. */
export function onFeedback(fb: Feedback): void {
  if (config.useKafka) {
    publish(TOPICS.FEEDBACK, { type: "ad-feedback", ...fb, ts: Date.now() });
  } else {
    // Direct: ML service ke HTTP /feedback endpoint pe bhejo (fire-and-forget).
    axios
      .post(`${config.mlServiceUrl}/feedback`, { ...fb }, { timeout: 1000 })
      .catch((err) => logger.warn({ err: err.message }, "feedback post failed"));
  }
}
