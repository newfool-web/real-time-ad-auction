# Build context = repo root (monorepo).
FROM node:22-slim
RUN corepack enable

WORKDIR /repo
COPY pnpm-workspace.yaml package.json ./
COPY api/shared ./api/shared
COPY api/auction-engine ./api/auction-engine

RUN pnpm install
RUN pnpm --filter @rtb/shared build

WORKDIR /repo/api/auction-engine
CMD ["pnpm", "start"]
