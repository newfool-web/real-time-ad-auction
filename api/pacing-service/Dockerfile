# Build context = repo root (monorepo).
FROM node:22-slim
RUN corepack enable

WORKDIR /repo
COPY pnpm-workspace.yaml package.json ./
COPY api/pacing-service ./api/pacing-service

RUN pnpm install

WORKDIR /repo/api/pacing-service
CMD ["pnpm", "start"]
