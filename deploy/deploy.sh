#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# EcoPlate Blue-Green Deployment Script
#
# Usage:
#   bash deploy.sh           # Normal deployment (auto blue/green switch)
#   bash deploy.sh rollback  # Switch back to the previous environment
# =============================================================================

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="${DEPLOY_DIR}/.active-env"
NGINX_UPSTREAM="/etc/nginx/ecoplate-upstream.conf"

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

# Read active environment from state file
get_active_env() {
    if [[ -f "$STATE_FILE" ]]; then
        cat "$STATE_FILE"
    else
        echo "none"
    fi
}

# Determine which environment to deploy to
get_target_env() {
    local active
    active="$(get_active_env)"
    case "$active" in
        blue)  echo "green" ;;
        green) echo "blue" ;;
        *)     echo "blue" ;;
    esac
}

# Get the app port for an environment
get_app_port() {
    case "$1" in
        blue)  echo "3001" ;;
        green) echo "3002" ;;
    esac
}

# Get the recommendation port for an environment
get_rec_port() {
    case "$1" in
        blue)  echo "5001" ;;
        green) echo "5002" ;;
    esac
}

# Pull latest Docker images
pull_images() {
    log "Pulling images with tag: ${IMAGE_TAG:-latest}"
    docker pull "${APP_IMAGE}:${IMAGE_TAG:-latest}"
    docker pull "${REC_IMAGE}:${IMAGE_TAG:-latest}"
}

# Start an environment
start_env() {
    local env="$1"
    log "Starting ${env} environment..."
    docker compose -f "${DEPLOY_DIR}/docker-compose.${env}.yml" \
        --env-file "${DEPLOY_DIR}/.env" \
        up -d --pull never --remove-orphans
}

# Stop an environment
stop_env() {
    local env="$1"
    log "Stopping ${env} environment..."
    docker compose -f "${DEPLOY_DIR}/docker-compose.${env}.yml" \
        --env-file "${DEPLOY_DIR}/.env" \
        down --remove-orphans || true
}

# Health check: wait for services to become healthy
wait_for_health() {
    local env="$1"
    local app_port rec_port
    app_port="$(get_app_port "$env")"
    rec_port="$(get_rec_port "$env")"

    log "Waiting for ${env} services to become healthy..."

    # Check recommendation engine first
    local i=0
    while (( i < HEALTH_RETRIES )); do
        if curl -sf "http://127.0.0.1:${rec_port}/health" > /dev/null 2>&1; then
            log "Recommendation engine (${env}) is healthy on port ${rec_port}"
            break
        fi
        (( i++ ))
        if (( i >= HEALTH_RETRIES )); then
            err "Recommendation engine (${env}) failed health check after $((HEALTH_RETRIES * HEALTH_INTERVAL))s"
            return 1
        fi
        sleep "$HEALTH_INTERVAL"
    done

    # Check main app
    i=0
    while (( i < HEALTH_RETRIES )); do
        if curl -sf "http://127.0.0.1:${app_port}/api/v1/health" > /dev/null 2>&1; then
            log "App (${env}) is healthy on port ${app_port}"
            return 0
        fi
        (( i++ ))
        if (( i >= HEALTH_RETRIES )); then
            err "App (${env}) failed health check after $((HEALTH_RETRIES * HEALTH_INTERVAL))s"
            return 1
        fi
        sleep "$HEALTH_INTERVAL"
    done
}

# Switch Nginx upstream to point to the target environment
switch_nginx() {
    local env="$1"
    log "Switching Nginx upstream to ${env}..."
    sudo cp "${DEPLOY_DIR}/nginx-upstream-${env}.conf" "$NGINX_UPSTREAM"
    sudo nginx -t && sudo nginx -s reload
    log "Nginx now pointing to ${env}"
}

# Save active environment to state file
save_active_env() {
    echo "$1" > "$STATE_FILE"
    log "Active environment saved: $1"
}

# =============================================================================
# Main deployment flow
# =============================================================================

deploy() {
    local active target
    active="$(get_active_env)"
    target="$(get_target_env)"

    log "============================================"
    log "  EcoPlate Blue-Green Deployment"
    log "  Active: ${active} -> Target: ${target}"
    log "============================================"

    # Export image tag for docker compose
    export IMAGE_TAG="${IMAGE_TAG:-latest}"
    export APP_IMAGE="${APP_IMAGE}"
    export REC_IMAGE="${REC_IMAGE}"

    # Step 1: Pull new images
    pull_images

    # Step 2: Stop inactive (target) environment if running
    stop_env "$target"

    # Step 3: Start the target environment with new images
    start_env "$target"

    # Step 4: Wait for health checks
    if ! wait_for_health "$target"; then
        err "Health checks failed for ${target}. Rolling back..."
        stop_env "$target"
        err "Deployment FAILED. ${active} is still active."
        exit 1
    fi

    # Step 5: Switch Nginx traffic to new environment
    switch_nginx "$target"

    # Step 6: Save state
    save_active_env "$target"

    log "============================================"
    log "  Deployment SUCCESSFUL!"
    log "  Active: ${target}"
    log "  Previous (${active}) kept as fallback"
    log "============================================"
}

# =============================================================================
# Rollback: switch back to the previous environment
# =============================================================================

rollback() {
    local active target
    active="$(get_active_env)"

    case "$active" in
        blue)  target="green" ;;
        green) target="blue" ;;
        *)
            err "No active environment to roll back from."
            exit 1
            ;;
    esac

    log "============================================"
    log "  Rolling back: ${active} -> ${target}"
    log "============================================"

    # Verify the fallback environment is still running
    local app_port
    app_port="$(get_app_port "$target")"
    if ! curl -sf "http://127.0.0.1:${app_port}/api/v1/health" > /dev/null 2>&1; then
        err "Fallback environment (${target}) is not healthy. Cannot rollback."
        exit 1
    fi

    switch_nginx "$target"
    save_active_env "$target"

    log "Rollback SUCCESSFUL. Active: ${target}"
}

# =============================================================================
# Entry point
# =============================================================================

case "${1:-deploy}" in
    rollback) rollback ;;
    deploy|"") deploy ;;
    *)
        err "Unknown command: $1"
        echo "Usage: bash deploy.sh [deploy|rollback]"
        exit 1
        ;;
esac
