// Pacing service — 'auction-events' consume karke budgets ko Redis me deduct karta hai
// + win/spend stats update karta hai.
//
// REAL-WORLD point: giant ad systems har auction pe exact global budget check NAHI kar
// sakte (thousands of machines). Spend stream se aggregate hota hai aur budget eventually
// consistent hota hai. Yahan bhi deduct async hai — chhota overspend ho sakta hai (CAP
// trade-off), jo realistic hai. Bidders Redis se budget padhte hain; ye service likhta hai.
import Redis from "ioredis";
import { Kafka, logLevel } from "kafkajs";
import pino from "pino";

const logger = pino({ name: "pacing-service", level: process.env.LOG_LEVEL ?? "info" });

const TOPIC = "auction-events";
const broker = process.env.KAFKA_BROKER ?? "localhost:9092";
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const kafka = new Kafka({
  clientId: "pacing-service",
  brokers: [broker],
  logLevel: logLevel.NOTHING,
  retry: { retries: 12, initialRetryTime: 1000 },
});
const consumer = kafka.consumer({ groupId: "pacing-service" });

interface AuctionCompleted {
  type: string;
  result: { winnerId: string | null; clearingPrice: number; filled: boolean };
}

async function pace(evt: AuctionCompleted) {
  const r = evt.result;
  if (!r.filled || !r.winnerId) return;
  // Eventually-consistent deduct + stats. (Bidder budget GET karta hai, ye SET/DECR karta hai.)
  await redis.incrbyfloat(`budget:${r.winnerId}`, -r.clearingPrice);
  await redis.hincrby(`stats:${r.winnerId}`, "wins", 1);
  await redis.hincrbyfloat(`stats:${r.winnerId}`, "spend", r.clearingPrice);
}

async function ensureTopic() {
  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({ topics: [{ topic: TOPIC, numPartitions: 1 }], waitForLeaders: true });
  await admin.disconnect();
}

async function main() {
  await ensureTopic();
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });
  logger.info({ broker, topic: TOPIC }, "pacing budgets from stream");

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const evt = JSON.parse(message.value.toString()) as AuctionCompleted;
        if (evt.type === "auction-completed") await pace(evt);
      } catch (err) {
        logger.error({ err: (err as Error).message }, "pacing failed for message");
      }
    },
  });
}

main().catch((err) => {
  logger.error({ err }, "pacing-service failed to start");
  process.exit(1);
});
