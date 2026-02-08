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

    # Check main app
    i=0
    while (( i < HEALTH_RETRIES )); do
        if curl -sf "http://127.0.0.1:3000/api/v1/health" > /dev/null 2>&1; then
            log "App is healthy"
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

    # Step 1: Pull new images
    pull_images

    # Step 2: Stop current environment
    log "Stopping current environment..."
    docker compose -f "$COMPOSE_FILE" --env-file "${DEPLOY_DIR}/.env" down --remove-orphans || true
    # Force-remove named containers in case they're orphaned from a previous project
    docker rm -f ecoplate-app ecoplate-recommendation 2>/dev/null || true

    # Step 2.5: Prune unused images to free disk space
    log "Pruning unused Docker images..."
    docker image prune -af --filter "until=24h" || true

    # Step 3: Start with new images
    log "Starting environment with new images..."
    docker compose -f "$COMPOSE_FILE" --env-file "${DEPLOY_DIR}/.env" up -d --pull never --remove-orphans

    # Step 4: Wait for health checks
    if ! wait_for_health; then
        err "Health checks failed. Deployment FAILED."
        exit 1
    fi

    # Step 5: Ensure Nginx headers-more module is installed (to hide Server header)
    if ! nginx -V 2>&1 | grep -q "headers-more"; then
        log "Installing nginx headers-more module..."
        sudo apt-get install -y -qq libnginx-mod-http-headers-more-filter 2>/dev/null || \
            warn "Could not install headers-more module, Server header will not be fully hidden"
    fi

    # Step 6: Update Nginx configuration and reload
    log "Updating Nginx configuration..."
    sudo cp "${DEPLOY_DIR}/nginx.conf" /etc/nginx/conf.d/default.conf
    sudo cp "${DEPLOY_DIR}/nginx-upstream.conf" /etc/nginx/ecoplate-upstream.conf
    sudo nginx -t && sudo nginx -s reload

    # Step 6: Clean up old Docker images to free disk space
    log "Cleaning up old Docker images..."
    docker image prune -af --filter "until=1h" 2>/dev/null || true

    log "============================================"
    log "  Deployment SUCCESSFUL!"
    log "============================================"
}

deploy
