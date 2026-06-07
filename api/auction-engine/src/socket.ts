// Socket.IO server — sirf DIRECT mode (USE_KAFKA=false) me use hota hai.
// Kafka mode me socket-gateway service ye kaam karta hai (engine isse touch nahi karta).
import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { logger } from "./logger";

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): void {
  io = new Server(httpServer, { cors: { origin: "*" } });
  io.on("connection", (socket) => {
    logger.info({ id: socket.id }, "dashboard connected");
    socket.on("disconnect", () => logger.info({ id: socket.id }, "dashboard disconnected"));
  });
}

export function emitDirect(event: string, payload: unknown): void {
  io?.emit(event, payload);
}
