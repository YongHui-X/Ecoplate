# EcoPlate Unified Dockerfile
# Runs both frontend and backend in a single container

# =============================================================================
# Stage 1: Build Frontend
# =============================================================================
FROM oven/bun:1-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package.json frontend/bun.lockb* ./

# Install frontend dependencies
RUN bun install --frozen-lockfile

# Copy frontend source
COPY frontend/ .

# Build frontend (outputs to /app/frontend/dist)
RUN bun run build

# =============================================================================
# Stage 2: Build Backend
# =============================================================================
FROM oven/bun:1-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY backend/package.json backend/bun.lockb* ./

# Install backend dependencies
RUN bun install --frozen-lockfile

# Copy backend source
COPY backend/ .

# =============================================================================
# Stage 3: Production Runtime
# =============================================================================
FROM oven/bun:1-alpine AS production

WORKDIR /app

# Update system packages to get security patches
RUN apk update && apk upgrade --no-cache

# Create non-root user for security
RUN addgroup -g 1001 -S ecoplate && \
    adduser -S ecoplate -u 1001

# Copy backend with dependencies
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/src ./src
COPY --from=backend-builder /app/backend/package.json ./
COPY --from=backend-builder /app/backend/tsconfig.json ./
COPY --from=backend-builder /app/backend/drizzle.config.ts ./

# Copy frontend build output to be served by backend
COPY --from=frontend-builder /app/frontend/dist ./public

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh

# Create data directory for SQLite and make entrypoint executable
RUN mkdir -p /app/data && chmod +x /app/entrypoint.sh && chown -R ecoplate:ecoplate /app

# Switch to non-root user
USER ecoplate

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=5 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Start with entrypoint (runs migration + seed if needed, then starts server)
ENTRYPOINT ["sh", "/app/entrypoint.sh"]
