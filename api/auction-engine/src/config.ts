function num(key: string, def: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return def; // blank env -> default (warna Number("")=0)
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export interface BidderEndpoint {
  bidderId: string;
  url: string; // e.g. http://bidder-nike:5001
  name: string; // display name e.g. "Nike"
}

export const config = {
  port: num("ENGINE_PORT", 4000),
  timeoutMs: num("AUCTION_TIMEOUT_MS", 100),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  kafkaBroker: process.env.KAFKA_BROKER ?? "localhost:9092",
  // USE_KAFKA=true (default, LOCAL): events go through Kafka -> consumers (full architecture).
  // USE_KAFKA=false (PROD/A1): engine does the side-effects directly (no Kafka/consumers needed).
  useKafka: (process.env.USE_KAFKA ?? "true") !== "false",
  databaseUrl: process.env.DATABASE_URL ?? "",
  databaseSsl: process.env.DATABASE_SSL === "true",
  mlServiceUrl: process.env.ML_SERVICE_URL ?? "http://localhost:8000",
  // Comma-separated list: id|url|name , id|url|name ...
  bidders: (process.env.BIDDERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair): BidderEndpoint => {
      const [bidderId, url, name] = pair.split("|");
      return { bidderId, url, name: name ?? bidderId };
    }),
};
