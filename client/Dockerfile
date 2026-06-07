FROM node:22-slim
RUN corepack enable

WORKDIR /app
COPY client/package.json ./
RUN pnpm install

COPY client ./

# Browser engine ko host ke mapped port pe call karta hai (docker-internal naam nahi).
ARG VITE_ENGINE_URL=http://localhost:4000
ENV VITE_ENGINE_URL=$VITE_ENGINE_URL
RUN pnpm build

EXPOSE 5173
CMD ["pnpm", "preview"]
