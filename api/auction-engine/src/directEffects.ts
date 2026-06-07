// DIRECT mode implementation (USE_KAFKA=false). Engine khud Socket.IO push karta hai,
// Postgres me history likhta hai, aur Redis me budget pace karta hai — Kafka ke bina.
import { Server as HttpServer } from "http";
import { initSocket, emitDirect } from "./socket";
import { initDb, logAuction } from "./db";
import { paceBudget } from "./redis";
import { logger } from "./logger";
import type { CompletedAuction } from "./effects";

export { emitDirect };

export async function initDirect(httpServer: HttpServer): Promise<void> {
  initSocket(httpServer);
  await initDb();
}

export function persistAndPace(c: CompletedAuction): void {
  // History (fire-and-forget).
  logAuction(c.slot, c.floor, c.result);
  // Budget pacing (fire-and-forget) — winner ka spend deduct.
  if (c.result.filled && c.result.winnerId) {
    paceBudget(c.result.winnerId, c.result.clearingPrice).catch((err) =>
      logger.warn({ err: err.message }, "pace failed")
    );
  }
}
