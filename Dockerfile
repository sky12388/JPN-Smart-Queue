# Multi-stage Dockerfile for SmartQueueJPN Debian Appliance
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies for sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production Runner Stage
FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/backend ./src/backend

# Create directory for persistent SQLite database
RUN mkdir -p /app/data
ENV DB_PATH=/app/data/smartqueue.db

EXPOSE 3000

CMD ["node", "src/backend/server.js"]
