#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# EcoPlate Deployment Script
# =============================================================================

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.prod.yml"

HEALTH_RETRIES=30
HEALTH_INTERVAL=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DEPLOY]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# Pull latest Docker images
pull_images() {
    log "Pulling images with tag: ${IMAGE_TAG:-latest}"
    docker pull "${APP_IMAGE}:${IMAGE_TAG:-latest}"
    docker pull "${REC_IMAGE}:${IMAGE_TAG:-latest}"
}

# Health check: wait for services to become healthy
wait_for_health() {
    log "Waiting for services to become healthy..."

    # Check recommendation engine first
    local i=0
    while (( i < HEALTH_RETRIES )); do
        if curl -sf "http://127.0.0.1:5000/health" > /dev/null 2>&1; then
            log "Recommendation engine is healthy"
            break
        fi
        (( i++ ))
        if (( i >= HEALTH_RETRIES )); then
            err "Recommendation engine failed health check after $((HEALTH_RETRIES * HEALTH_INTERVAL))s"
            return 1
        fi
        sleep "$HEALTH_INTERVAL"
    done

    # Check main app via nginx (HTTPS on port 443)
    i=0
    while (( i < HEALTH_RETRIES )); do
        if curl -sfk "https://127.0.0.1:443/api/v1/health" > /dev/null 2>&1; then
            log "App (via nginx HTTPS) is healthy"
            return 0
        fi
        (( i++ ))
        if (( i >= HEALTH_RETRIES )); then
            err "App failed health check after $((HEALTH_RETRIES * HEALTH_INTERVAL))s"
            return 1
        fi
        sleep "$HEALTH_INTERVAL"
    done
}

# =============================================================================
# Main deployment flow
# =============================================================================

deploy() {
    log "============================================"
    log "  EcoPlate Deployment"
    log "============================================"

    export IMAGE_TAG="${IMAGE_TAG:-latest}"
    export APP_IMAGE="${APP_IMAGE}"
    export REC_IMAGE="${REC_IMAGE}"

    # Step 0: Ensure SSL certificates exist
    local ssl_dir="${DEPLOY_DIR}/ssl"
    if [ ! -f "${ssl_dir}/cert.pem" ] || [ ! -f "${ssl_dir}/key.pem" ]; then
        log "Generating self-signed SSL certificate..."
        mkdir -p "${ssl_dir}"
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "${ssl_dir}/key.pem" \
            -out "${ssl_dir}/cert.pem" \
            -subj "/CN=ecoplate/O=EcoPlate/C=SG" \
            -addext "subjectAltName=IP:18.143.173.20" 2>/dev/null
        chmod 644 "${ssl_dir}/cert.pem" "${ssl_dir}/key.pem"
        log "SSL certificate generated at ${ssl_dir}/"
    else
        log "SSL certificates already exist"
    fi

    # Step 0.5: Ensure external volumes exist
    log "Ensuring Docker volumes exist..."
    docker volume create ecoplate-data 2>/dev/null || true
    docker volume create ecoplate-uploads 2>/dev/null || true

    # Step 1: Pull new images
    pull_images

    # Step 2: Stop host nginx if running (replaced by containerized nginx)
    if systemctl is-active --quiet nginx 2>/dev/null; then
        log "Stopping host nginx (replaced by containerized nginx)..."
        sudo systemctl stop nginx 2>/dev/null || true
        sudo systemctl disable nginx 2>/dev/null || true
    fi

    # Step 3: Stop current environment
    log "Stopping current environment..."
    docker compose -f "$COMPOSE_FILE" --env-file "${DEPLOY_DIR}/.env" down --remove-orphans || true
    # Force-remove named containers in case they're orphaned from a previous project
    docker rm -f ecoplate-app ecoplate-recommendation ecoplate-nginx 2>/dev/null || true

    # Step 4: Start with new images (includes containerized nginx with headers-more module)
    log "Starting environment with new images..."
    docker compose -f "$COMPOSE_FILE" --env-file "${DEPLOY_DIR}/.env" up -d --build --pull never --remove-orphans

    # Step 5: Wait for health checks
    if ! wait_for_health; then
        err "Health checks failed. Deployment FAILED."
        exit 1
    fi

    # Step 6: Clean up old Docker images to free disk space
    log "Cleaning up old Docker images..."
    docker image prune -af --filter "until=1h" 2>/dev/null || true

    log "============================================"
    log "  Deployment SUCCESSFUL!"
    log "============================================"
}

deploy
