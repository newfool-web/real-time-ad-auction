// History writer — Kafka 'auction-events' consume karke Postgres me likhta hai.
// Engine ab DB ko directly nahi likhta; ye consumer stream se persist karta hai
// (decoupled, replayable, scalable — real ad systems isi tarah karte hain).
import { Kafka, logLevel } from "kafkajs";
import { Pool } from "pg";
import pino from "pino";

const logger = pino({ name: "history-writer", level: process.env.LOG_LEVEL ?? "info" });

const TOPIC = "auction-events";
const broker = process.env.KAFKA_BROKER ?? "localhost:9092";
const databaseUrl = process.env.DATABASE_URL ?? "";
// Cloud Postgres (Supabase/Neon/RDS) needs SSL; local docker Postgres does not.
const useSsl = process.env.DATABASE_SSL === "true";

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});
const kafka = new Kafka({
  clientId: "history-writer",
  brokers: [broker],
  logLevel: logLevel.NOTHING,
  retry: { retries: 12, initialRetryTime: 1000 },
});
const consumer = kafka.consumer({ groupId: "history-writer" });

interface AuctionCompleted {
  type: string;
  auctionId: string;
  slot: string;
  floor: number;
  result: {
    winnerId: string | null;
    clearingPrice: number;
    numBids: number;
    filled: boolean;
  };
}

async function initDb(): Promise<void> {
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
  logger.info("postgres ready");
}

async function persist(evt: AuctionCompleted): Promise<void> {
  const r = evt.result;
  await pool.query(
    `INSERT INTO auctions (id, slot, floor, winner_id, clearing_price, num_bids, filled)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
    [evt.auctionId, evt.slot, evt.floor, r.winnerId, r.clearingPrice, r.numBids, r.filled]
  );
}

async function ensureTopic() {
  // Topic pehle se bana lo taaki subscribe race na ho (engine produce kare us se pehle).
  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({ topics: [{ topic: TOPIC, numPartitions: 1 }], waitForLeaders: true });
  await admin.disconnect();
}

async function main() {
  await initDb();
  await ensureTopic();
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });
  logger.info({ broker, topic: TOPIC }, "consuming auction events");

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const evt = JSON.parse(message.value.toString()) as AuctionCompleted;
        if (evt.type === "auction-completed") {
          await persist(evt);
          logger.debug({ auctionId: evt.auctionId, winner: evt.result.winnerId }, "history written");
        }
      } catch (err) {
        logger.error({ err: (err as Error).message }, "failed to process message");
      }
    },
  });
}

main().catch((err) => {
  logger.error({ err }, "history-writer failed to start");
  process.exit(1);
});
