# Build context = repo root (monorepo).
FROM node:22-slim
RUN corepack enable

WORKDIR /repo
COPY pnpm-workspace.yaml package.json ./
COPY api/history-writer ./api/history-writer

RUN pnpm install

WORKDIR /repo/api/history-writer
CMD ["pnpm", "start"]
