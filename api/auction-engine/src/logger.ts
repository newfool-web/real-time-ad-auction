import pino from "pino";

export const logger = pino({
  name: "auction-engine",
  level: process.env.LOG_LEVEL ?? "info",
});
