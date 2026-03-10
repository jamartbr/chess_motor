FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace root for monorepo resolution
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/engine ./packages/engine
COPY packages/server ./packages/server

RUN npm ci --workspace=packages/engine --workspace=packages/server
RUN npm run build --workspace=packages/engine
RUN npm run build --workspace=packages/server

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/package*.json ./
COPY --from=builder /app/packages/engine/dist ./node_modules/@chess-motor/engine/dist
COPY --from=builder /app/packages/engine/package.json ./node_modules/@chess-motor/engine/

RUN npm ci --omit=dev

EXPOSE 3000
CMD ["node", "dist/index.js"]
