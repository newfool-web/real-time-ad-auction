FROM node:22-slim
RUN corepack enable

WORKDIR /app
COPY client/package.json ./
RUN pnpm install

COPY client ./

# Browser host ke public address pe call karta hai (docker-internal naam nahi).
# Dono URLs build-time pe inject hote hain: engine (REST) aur gateway (Socket.IO).
ARG VITE_ENGINE_URL=http://localhost:4100
ARG VITE_GATEWAY_URL=http://localhost:4200
ENV VITE_ENGINE_URL=$VITE_ENGINE_URL
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL
RUN pnpm build

EXPOSE 5173
CMD ["pnpm", "preview"]
