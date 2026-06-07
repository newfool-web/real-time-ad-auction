// Socket gateway — 'ui-events' Kafka topic consume karke dashboard ko Socket.IO se bhejta hai.
// Engine ab dashboard se directly coupled nahi hai (real ad systems ka pattern:
// dashboard stream padhta hai, serving box ko nahi).
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { Kafka, logLevel } from "kafkajs";
import pino from "pino";

const logger = pino({ name: "socket-gateway", level: process.env.LOG_LEVEL ?? "info" });

const TOPIC = "ui-events";
const broker = process.env.KAFKA_BROKER ?? "localhost:9092";
const port = Number(process.env.PORT ?? 4200);

const app = express();
app.use(cors());
app.get("/health", (_req, res) => res.json({ status: "ok" }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  logger.info({ id: socket.id }, "dashboard connected");
  socket.on("disconnect", () => logger.info({ id: socket.id }, "dashboard disconnected"));
});

const kafka = new Kafka({
  clientId: "socket-gateway",
  brokers: [broker],
  logLevel: logLevel.NOTHING,
  retry: { retries: 12, initialRetryTime: 1000 },
});
const consumer = kafka.consumer({ groupId: "socket-gateway" });

interface UiEvent {
  event: string;
  payload: unknown;
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
  // fromBeginning: false -> sirf naye events relay karo (purana backlog nahi).
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const evt = JSON.parse(message.value.toString()) as UiEvent;
        io.emit(evt.event, evt.payload); // stream event -> dashboard
      } catch (err) {
        logger.error({ err: (err as Error).message }, "bad ui-event");
      }
    },
  });

  httpServer.listen(port, () => logger.info({ port, broker }, "socket-gateway up"));
}

main().catch((err) => {
  logger.error({ err }, "socket-gateway failed to start");
  process.exit(1);
});
