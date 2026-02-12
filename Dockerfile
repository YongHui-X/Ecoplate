# EcoPlate Unified Dockerfile
# Runs both frontend and backend in a single container

# =============================================================================
# Stage 1: Build Frontend
# =============================================================================
# Pin to specific version for reproducible builds and security
FROM oven/bun:1.2.5-alpine AS frontend-builder

# Build args for frontend environment variables
# Note: VITE_ prefixed keys are client-side and intentionally public (embedded in JS bundle)
# Security is enforced via Google Cloud Console API key restrictions, not secrecy
# hadolint ignore=DL3044
ARG VITE_GOOGLE_MAPS_API_KEY
# hadolint ignore=DL3044
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package.json frontend/bun.lockb* ./

# Install frontend dependencies
RUN bun install

# Copy frontend source
COPY frontend/ .

# Build frontend (outputs to /app/frontend/dist)
RUN bun run build

# =============================================================================
# Stage 2: Build Backend
# =============================================================================
FROM oven/bun:1.2.5-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY backend/package.json backend/bun.lockb* ./

# Install backend dependencies
RUN bun install

# Copy backend source
COPY backend/ .

# =============================================================================
# Stage 3: Production Runtime
# =============================================================================
FROM oven/bun:1.2.5-alpine AS production

WORKDIR /app

# Update system packages to get security patches, install wget for health checks, and tzdata for timezone support
RUN apk update && apk upgrade --no-cache && apk add --no-cache wget tzdata

# Create non-root user for security
RUN addgroup -g 1001 -S ecoplate && \
    adduser -S ecoplate -u 1001

# Copy backend source and config
COPY --from=backend-builder /app/backend/src ./src
COPY --from=backend-builder /app/backend/package.json ./
COPY --from=backend-builder /app/backend/tsconfig.json ./
COPY --from=backend-builder /app/backend/drizzle.config.ts ./
COPY --from=backend-builder /app/backend/bun.lockb* ./

# Install production-only dependencies, then clean all scan-triggering artifacts in same layer
# Go binaries in node_modules cause Trivy CVEs (CVE-2024-24790, CVE-2023-39325, CVE-2025-58183)
# Bun cache contains bun-types docs with example Stripe key (Trivy secret false positive)
RUN bun install --production && \
    rm -rf node_modules/@esbuild node_modules/esbuild node_modules/drizzle-kit && \
    grep -rl "Go BuildID" node_modules/ 2>/dev/null | xargs rm -f 2>/dev/null || true && \
    rm -rf /root/.bun/install/cache

# Copy frontend build output to be served by backend
COPY --from=frontend-builder /app/frontend/dist ./public

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh

# Remove any remaining Go binaries from base image paths
RUN grep -rl "Go BuildID" /usr/local/bin/ 2>/dev/null | xargs rm -f 2>/dev/null || true

# Create data and uploads directories, set ownership, make entrypoint executable
RUN mkdir -p /app/data /app/public/uploads && chmod +x /app/entrypoint.sh && chown -R ecoplate:ecoplate /app

# Run as non-root user (CWE-269: Improper Privilege Management)
# Named Docker volumes inherit directory ownership from the container,
# so /app/data and /app/public/uploads will be writable by ecoplate.
USER ecoplate

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=5 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Start with entrypoint (runs migration + seed, then starts server)
ENTRYPOINT ["sh", "/app/entrypoint.sh"]
