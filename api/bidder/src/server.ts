import express from "express";
import { BidRequest } from "@rtb/shared";
import { config } from "./config";
import { logger } from "./logger";
import { initBudget, getBudget } from "./redis";
import { evaluate } from "./bidding";

const app = express();
app.use(express.json());

app.get("/health", async (_req, res) => {
  res.json({ status: "ok", bidderId: config.bidderId, budget: await getBudget() });
});

// Engine isi endpoint pe concurrent bid request bhejta hai.
app.post("/bid", async (req, res) => {
  try {
    const bidReq = req.body as BidRequest;
    const response = await evaluate(bidReq);
    res.json(response);
  } catch (err) {
    logger.error({ err }, "bid evaluation failed");
    res.status(500).json({ error: "bid_failed" });
  }
});

async function main() {
  await initBudget();
  app.listen(config.port, () => {
    logger.info({ port: config.port, category: config.adCategory }, "bidder up");
  });
}

main().catch((err) => {
  logger.error({ err }, "bidder failed to start");
  process.exit(1);
});
