import pino from "pino";
import { config } from "./config";

export const logger = pino({
  name: config.bidderId,
  level: process.env.LOG_LEVEL ?? "info",
});
