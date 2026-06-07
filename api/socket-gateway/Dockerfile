# Build context = repo root (monorepo).
FROM node:22-slim
RUN corepack enable

WORKDIR /repo
COPY pnpm-workspace.yaml package.json ./
COPY api/socket-gateway ./api/socket-gateway

RUN pnpm install

WORKDIR /repo/api/socket-gateway
CMD ["pnpm", "start"]
