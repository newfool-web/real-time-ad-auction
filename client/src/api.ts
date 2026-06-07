import axios from "axios";

// Control plane (REST trigger) = engine. Data plane (live events) = socket-gateway.
export const ENGINE_URL = (import.meta as any).env?.VITE_ENGINE_URL ?? "http://localhost:4000";
export const GATEWAY_URL = (import.meta as any).env?.VITE_GATEWAY_URL ?? "http://localhost:4200";

const client = axios.create({ baseURL: ENGINE_URL });

export const simulateVisit = () => client.post("/auction/random");
export const setTraffic = (ratePerSec: number) => client.post("/traffic", { ratePerSec });
