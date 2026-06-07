import { createServer } from "http";
import express from "express";
import cors from "cors";
import { AdRequest } from "@rtb/shared";
import { config } from "./config";
import { logger } from "./logger";
import { runAuction } from "./auction";
import { recordAuction, startMetricsLoop, buildMetrics } from "./metrics";
import { initEffects, Emit } from "./effects";
import { randomAdRequest } from "./fixtures";

const app = express();
app.use(cors());
app.use(express.json());

// httpServer chahiye taaki DIRECT mode me Socket.IO isi pe attach ho sake.
const httpServer = createServer(app);

// emit ko initEffects set karta hai (KAFKA mode -> ui-events topic; DIRECT mode -> Socket.IO).
let emit: Emit = () => {};

// Auto-traffic generator state.
let trafficTimer: NodeJS.Timeout | null = null;

async function handleAuction(adReq: AdRequest) {
  const start = Date.now();
  const result = await runAuction(adReq, emit);
  recordAuction(result.filled, Date.now() - start);
  return result;
}

// Publisher se ad request -> auction run.
app.post("/auction", async (req, res) => {
  try {
    const result = await handleAuction(req.body as AdRequest);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "auction failed");
    res.status(500).json({ error: "auction_failed" });
  }
});

// Demo button: ek random visit simulate karo.
app.post("/auction/random", async (_req, res) => {
  res.json(await handleAuction(randomAdRequest()));
});

// Auto-traffic on/off (dashboard toggle). body: { ratePerSec }
app.post("/traffic", (req, res) => {
  const ratePerSec = Number(req.body?.ratePerSec ?? 0);
  if (trafficTimer) {
    clearInterval(trafficTimer);
    trafficTimer = null;
  }
  if (ratePerSec > 0) {
    const intervalMs = Math.max(1000 / ratePerSec, 20);
    trafficTimer = setInterval(() => {
      handleAuction(randomAdRequest()).catch((err) => logger.error({ err }, "auto auction failed"));
    }, intervalMs);
  }
  res.json({ ratePerSec, running: trafficTimer !== null });
});

app.get("/health", (_req, res) =>
  res.json({ status: "ok", bidders: config.bidders.length, mode: config.useKafka ? "kafka" : "direct" })
);
app.get("/metrics", async (_req, res) => res.json(await buildMetrics()));

async function main() {
  emit = await initEffects(httpServer); // KAFKA ya DIRECT mode wire karta hai
  startMetricsLoop(emit);
  httpServer.listen(config.port, () => {
    logger.info(
      { port: config.port, mode: config.useKafka ? "kafka" : "direct", bidders: config.bidders.map((b) => b.bidderId) },
      "auction engine up"
    );
  });
}

main().catch((err) => {
  logger.error({ err }, "engine failed to start");
  process.exit(1);
});
