# ── Stage 1: Build TypeScript Backend ─────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production Execution ────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

# Copy compiled JavaScript and DB schema files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/schema.sql ./dist/db/schema.sql
COPY --from=builder /app/src/db/schema.sql ./src/db/schema.sql

# Create backups and upload directory
RUN mkdir -p /app/backups

EXPOSE 5050

CMD ["node", "dist/index.js"]

