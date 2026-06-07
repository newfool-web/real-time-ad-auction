// Postgres history writer — sirf DIRECT mode (USE_KAFKA=false) me use hota hai.
// Kafka mode me history-writer consumer ye kaam karta hai.
import { Pool } from "pg";
import { AuctionResult } from "@rtb/shared";
import { config } from "./config";
import { logger } from "./logger";

let pool: Pool | null = null;

export async function initDb(): Promise<void> {
  pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auctions (
      id TEXT PRIMARY KEY,
      ts TIMESTAMPTZ DEFAULT now(),
      slot TEXT,
      floor NUMERIC,
      winner_id TEXT,
      clearing_price NUMERIC,
      num_bids INT,
      filled BOOLEAN
    )
  `);
  logger.info("postgres ready (direct mode)");
}

/** Fire-and-forget insert — auction loop isko await nahi karta. */
export function logAuction(slot: string, floor: number, r: AuctionResult): void {
  if (!pool) return;
  pool
    .query(
      `INSERT INTO auctions (id, slot, floor, winner_id, clearing_price, num_bids, filled)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [r.auctionId, slot, floor, r.winnerId, r.clearingPrice, r.numBids, r.filled]
    )
    .catch((err) => logger.warn({ err: err.message }, "auction log failed"));
}
