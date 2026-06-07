# Build context = repo root (monorepo). Shared package ko build karke chalate hain.
FROM node:22-slim
RUN corepack enable

WORKDIR /repo
COPY pnpm-workspace.yaml package.json ./
COPY api/shared ./api/shared
COPY api/bidder ./api/bidder

RUN pnpm install
RUN pnpm --filter @rtb/shared build

WORKDIR /repo/api/bidder
CMD ["pnpm", "start"]
