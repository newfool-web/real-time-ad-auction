<div align="center">

# Real-Time Ad Auction Engine

**A distributed, event-driven Real-Time Bidding (RTB) platform that simulates how modern ad exchanges run sub-100 ms auctions at scale.**

[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![Apache Kafka](https://img.shields.io/badge/Apache_Kafka-KRaft-231F20?logo=apachekafka&logoColor=white)](https://kafka.apache.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)](https://supabase.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com)

</div>

---

## Overview

This project recreates the two-plane architecture used by real ad exchanges (Google Ad Manager, The Trade Desk, Criteo):

- **Synchronous hot path** — an ad request fans out to multiple advertisers concurrently, who bid within a strict **100 ms deadline**; the engine runs a **second-price (Vickrey) auction** and returns the winning ad.
- **Asynchronous data plane** — every auction emits events to **Apache Kafka**, consumed by independent services for history persistence, live dashboard streaming, budget pacing, and online ML model retraining.

The defining design constraint: **streaming infrastructure never touches the bidding path.** Events are published fire-and-forget, keeping measured auction latency at ~65–75 ms even with the full event pipeline active.

## Key Features

- ⚡ **Concurrent fan-out under a hard deadline** — parallel bid requests with per-call timeouts (`Promise.allSettled` + `AbortController`); late bids are dropped.
- 🏷️ **Second-price auction** — winner pays the runner-up's price + $0.01, the mechanism that incentivizes truthful bidding.
- 🧠 **ML-driven bidding** — a Logistic Regression CTR model scores every impression; bids are `predictedCTR × clickValue`.
- 🔁 **Online learning loop** — click outcomes stream back through Kafka and retrain the model live.
- 📊 **Real-time dashboard** — Socket.IO streams every bid, win, and metric to a React UI as it happens.
- 🧩 **Event-driven microservices** — new capabilities are added as independent Kafka consumers without modifying the auction engine.
- 💰 **Eventually-consistent budget pacing** — budgets are paced from the event stream, mirroring the CAP trade-offs of large-scale ad systems.

## Tech Stack

| Layer | Technologies |
|---|---|
| **Engine, bidders, consumers** | Node.js · TypeScript · Express · Socket.IO · KafkaJS |
| **ML service** | Python · FastAPI · scikit-learn · kafka-python-ng |
| **Frontend** | React · TypeScript · Tailwind CSS · Recharts · socket.io-client |
| **Messaging** | Apache Kafka (KRaft mode) |
| **State & storage** | Redis (in-memory state) · PostgreSQL / Supabase (durable history) |
| **Infrastructure** | Docker · Docker Compose · pnpm workspaces (monorepo) |

## Services

| Service | Plane | Responsibility |
|---|---|---|
| `auction-engine` | Hot path | Concurrent fan-out, 100 ms deadline, second-price settlement, Kafka producer |
| `bidder` ×8 | Hot path | Per-brand bidding: targeting → budget check → CTR prediction → bid |
| `ml-service` | Hot + data | Serves CTR predictions; retrains the model from the feedback stream |
| `socket-gateway` | Data plane | Consumes `ui-events`, broadcasts to the dashboard via Socket.IO |
| `history-writer` | Data plane | Consumes `auction-events`, persists history to PostgreSQL |
| `pacing-service` | Data plane | Consumes `auction-events`, paces advertiser budgets in Redis |
| `dashboard` | UI | React dashboard — live auction pipeline and metrics |

## Setup

**Prerequisite:** [Docker](https://www.docker.com/) + Docker Compose.

```bash
git clone <your-repo-url> ad-auction
cd ad-auction
# create a .env file in the project root (see Configuration below)
docker compose up --build     # starts the whole stack
```

To stop: `docker compose down`. Ports are configurable in `.env`.

### Open these

| URL | What |
|---|---|
| **http://localhost:5273** | **Live dashboard** — the main UI |
| http://localhost:8085 | Kafka UI — watch events flow on the topics |
| http://localhost:5540 | RedisInsight — browse budgets & stats |

> PostgreSQL auction history is viewed in the **Supabase console**.

## Configuration

All configuration is supplied through environment variables in a root `.env` file (gitignored).
Create one with the following variables:

```env
# mode
USE_KAFKA
AUCTION_TIMEOUT_MS

# postgres
DATABASE_URL
DATABASE_SSL

# redis
REDIS_URL
REDIS_PORT

# kafka (used when USE_KAFKA=true)
KAFKA_BROKER
KAFKA_PORT

# services
ENGINE_PORT
ML_PORT
ML_SERVICE_URL
DASHBOARD_PORT
GATEWAY_PORT

# dev GUIs
REDISINSIGHT_PORT
KAFKA_UI_PORT
```

### Development vs. Production

The same codebase runs two ways, controlled by the single `USE_KAFKA` flag. The **auction
itself is identical** in both — only *how the post-auction work is delivered* changes.

**Development (`USE_KAFKA=true`) — the full architecture.**
Every auction publishes events to **Kafka**, and separate consumer services react to them:
history → Postgres, budget pacing → Redis, live updates → dashboard, click feedback → ML
retraining. This is the complete event-driven system you run locally to see and demo everything.

**Production (`USE_KAFKA=false`) — lean, no Kafka.**
Reliable free-tier managed Kafka is hard to obtain, and a broker needs an always-on host — so
production **does not run Kafka at all**. Instead the engine performs the same side-effects
**directly** (writes Postgres, updates Redis, emits Socket.IO, and POSTs click feedback to the
ML service over HTTP). Nothing is lost — including the **live ML retraining loop** — there's
just no message broker in between.

| Post-auction work | Dev (`USE_KAFKA=true`) | Prod (`USE_KAFKA=false`) |
|---|---|---|
| Live dashboard updates | Kafka → socket-gateway | engine → Socket.IO directly |
| Auction history | Kafka → history-writer → Postgres | engine → Postgres directly |
| Budget pacing | Kafka → pacing-service → Redis | engine → Redis directly |
| ML feedback loop | Kafka → ML trainer | engine → ML `/feedback` (HTTP) |
| Extra services running | Kafka + 3 consumers | none |

> **Why split it this way?** Kafka is the realistic, scalable design for a real ad exchange, so
> it powers the local system. But it's the one piece that's costly to host, so the deployed demo
> swaps it for direct calls via one env flag — no code changes.

## How It Works

**Hot path (synchronous).** The engine fans out bid requests to all advertisers in parallel with a per-call `AbortController`; any bidder exceeding `AUCTION_TIMEOUT_MS` is dropped. Valid bids are ranked in a MaxHeap — `pop()` yields the winner, `peek()` the runner-up — and the winner pays second price.

**ML-driven bids.** Each bidder requests a click-through-rate prediction and bids `predictedCTR × clickValue`. The CTR is computed per impression by a Logistic Regression model; `clickValue` is the advertiser's configured value of a click. Click outcomes feed back to the model, which retrains live (online learning).

**Effects layer.** All post-auction work (history, budget pacing, live UI, ML feedback) flows through an effects abstraction that either publishes to Kafka (dev) or performs the action directly (prod) — the auction logic is identical in both modes.

## Project Structure

```
ad-auction/
├── api/                    # Backend services (pnpm workspace)
│   ├── shared/             # Shared types, events, MaxHeap
│   ├── auction-engine/     # Hot path + Kafka producer
│   ├── bidder/             # One image → 8 configured advertisers
│   ├── ml-service/         # FastAPI CTR model + retraining consumer
│   ├── socket-gateway/     # ui-events → dashboard
│   ├── history-writer/     # auction-events → PostgreSQL
│   └── pacing-service/     # auction-events → Redis budgets
├── client/                 # React dashboard
└── docker-compose.yml      # Full-stack orchestration
```

## Deployment

Two options, both driven by the `USE_KAFKA` flag (no code changes):

- **Single VM (`USE_KAFKA=true`)** — run the full stack, including Kafka, on one cloud VM with `docker compose up` (set `PUBLIC_ENGINE_URL` / `PUBLIC_GATEWAY_URL` to the VM's address).
- **Managed services (`USE_KAFKA=false`)** — deploy engine, bidders, ML, and dashboard against managed Postgres/Redis; Kafka and the consumers are not used.
