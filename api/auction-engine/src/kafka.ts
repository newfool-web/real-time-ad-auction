// Kafka producer — saare async events isi se jate hain (multiple topics).
// IMPORTANT: HOT PATH me nahi. publish() fire-and-forget hai, auction kabhi block nahi hoti.
import { Kafka, Producer, logLevel } from "kafkajs";
import { config } from "./config";
import { logger } from "./logger";

export const TOPICS = {
  AUCTION: "auction-events", // completed auctions -> history-writer + pacing-service
  UI: "ui-events", // granular live events -> socket-gateway -> dashboard
  FEEDBACK: "ad-feedback", // impression/click feedback -> ML retraining
} as const;

const kafka = new Kafka({
  clientId: "auction-engine",
  brokers: [config.kafkaBroker],
  logLevel: logLevel.NOTHING,
  retry: { retries: 8 },
});

let producer: Producer | null = null;

export async function initKafka(): Promise<void> {
  const p = kafka.producer({ allowAutoTopicCreation: true });
  // Cold-start race: Kafka thodi der baad ready hota hai. Retry karte raho, warna ek
  // failed connect events ko hamesha ke liye disable kar deta hai.
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await p.connect();
      producer = p;
      logger.info({ broker: config.kafkaBroker }, "kafka producer connected");
      return;
    } catch (err) {
      logger.warn({ attempt, err: (err as Error).message }, "kafka connect failed, retrying in 3s");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  logger.error("kafka unreachable after retries, events disabled");
}

/** Fire-and-forget publish. Auction loop isko await NAHI karta. */
export function publish(topic: string, message: unknown): void {
  if (!producer) return;
  producer
    .send({ topic, messages: [{ value: JSON.stringify(message) }] })
    .catch((err) => logger.warn({ err: err.message, topic }, "kafka publish failed"));
}
