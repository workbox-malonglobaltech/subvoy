# Subvoy backend (API) image for Fly.io.
# Monorepo note: backend tsc emits to backend/dist/backend/src (entry) and the
# shared types to backend/dist/src/shared — the relative requires resolve within
# dist, and node_modules is hoisted at /app.

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-slim AS build
WORKDIR /app

# Install with the full workspace graph (lockfile + every workspace manifest).
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

# Build the backend (pulls in src/shared via imports).
COPY src ./src
COPY backend ./backend
RUN npm run build --workspace=backend

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Production dependencies only.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev && npm cache clean --force

# Compiled output (entry + shared types live under here).
COPY --from=build /app/backend/dist ./backend/dist
# Migration files are .sql — tsc doesn't emit them, so copy them into the
# compiled tree where migrate.js expects them (dist/backend/src/db/migrations).
COPY --from=build /app/backend/src/db/migrations ./backend/dist/backend/src/db/migrations

EXPOSE 8080
CMD ["node", "backend/dist/backend/src/index.js"]
