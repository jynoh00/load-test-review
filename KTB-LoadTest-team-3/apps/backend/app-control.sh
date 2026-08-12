#!/bin/bash

###############################################################################
# KTB Chat Backend Application Control Script
#
# Thin wrapper over the ktb-backend systemd unit that app hosts ship with.
# Registering the unit is the host provisioner's job, not the deploy's, so a
# new node needs no registration step — deploys only ship the artifact and
# restart.
#
# Usage:
#   ./app-control.sh start    - Start the application
#   ./app-control.sh stop     - Stop the application
#   ./app-control.sh restart  - Restart the application
#   ./app-control.sh status   - Check application status
###############################################################################

set -e

# Configuration
APP_NAME="ktb-chat-backend"
SERVICE="${SERVICE:-ktb-backend.service}"
JAR_FILE="target/ktb-chat-backend-0.0.1-SNAPSHOT.jar"
LOG_FILE="logs/app.log"
HEALTH_CHECK_URL="http://localhost:5001/api/health"
HEALTH_CHECK_TIMEOUT=60  # seconds
HEALTH_CHECK_INTERVAL=2  # seconds

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

###############################################################################
# Helpers
###############################################################################

# The unit ships with the host, so a missing one means this machine was never
# provisioned as an app server.
check_unit() {
    if systemctl list-unit-files "$SERVICE" >/dev/null 2>&1 && \
       systemctl cat "$SERVICE" >/dev/null 2>&1; then
        return 0
    fi
    log_error "systemd unit $SERVICE not found on this host"
    log_info "This machine is not provisioned as an app server"
    exit 1
}

check_jar() {
    if [ ! -f "$JAR_FILE" ]; then
        log_error "JAR file not found: $JAR_FILE"
        log_info "Deploy it first: make deploy-jar"
        exit 1
    fi
}

is_active() {
    systemctl is-active --quiet "$SERVICE"
}

wait_for_health() {
    log_info "Waiting for application to be healthy..."
    local elapsed=0

    while [ $elapsed -lt $HEALTH_CHECK_TIMEOUT ]; do
        if command -v curl &> /dev/null; then
            if curl -sf "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
                log_success "Application is healthy!"
                return 0
            fi
        elif command -v wget &> /dev/null; then
            if wget -q --spider "$HEALTH_CHECK_URL" 2>/dev/null; then
                log_success "Application is healthy!"
                return 0
            fi
        else
            log_warn "Neither curl nor wget available, skipping health check"
            return 0
        fi

        # Fail fast when the unit gave up instead of burning the full timeout.
        if ! is_active; then
            echo ""
            log_error "Service stopped while starting up"
            log_info "Inspect: journalctl -u $SERVICE -n 50 --no-pager"
            return 1
        fi

        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
        echo -n "."
    done

    echo ""
    log_warn "Health check timeout after ${HEALTH_CHECK_TIMEOUT}s"
    log_info "Application might still be starting up. Check logs: tail -f $LOG_FILE"
    return 1
}

###############################################################################
# Command Functions
###############################################################################

start() {
    check_unit

    if is_active; then
        log_warn "$APP_NAME is already running"
        return 0
    fi

    check_jar

    log_info "Starting $APP_NAME via $SERVICE..."
    sudo systemctl start "$SERVICE"
    wait_for_health
}

stop() {
    check_unit

    if ! is_active; then
        log_warn "$APP_NAME is not running"
        return 0
    fi

    log_info "Stopping $APP_NAME..."
    sudo systemctl stop "$SERVICE"
    log_success "$APP_NAME stopped"
}

restart() {
    check_unit
    check_jar

    log_info "Restarting $APP_NAME via $SERVICE..."
    sudo systemctl restart "$SERVICE"
    wait_for_health
}

status() {
    check_unit

    echo ""
    systemctl status "$SERVICE" --no-pager --lines 0 || true
    echo ""

    echo "  JAR: $([ -f "$JAR_FILE" ] && echo "${GREEN}Found${NC}" || echo "${YELLOW}Missing${NC}")"
    echo -e "  .env: $([ -f ".env" ] && echo "${GREEN}Found${NC}" || echo "${YELLOW}Not found${NC}")"
    echo -e "  Infra env: $([ -f "$HOME/ktb-chat.env" ] && echo "${GREEN}Found${NC}" || echo "${YELLOW}Not found${NC}")"

    if is_active; then
        if curl -sf "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            log_success "Health check passed"
        else
            log_warn "Running but health check failed"
        fi
    fi

    echo ""
    echo "  Logs: journalctl -u $SERVICE -f    (or tail -f $LOG_FILE)"
}

###############################################################################
# Main
###############################################################################

case "${1:-}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "Environment overrides:"
        echo "  SERVICE  - systemd unit name (default: ktb-backend.service)"
        exit 1
        ;;
esac
