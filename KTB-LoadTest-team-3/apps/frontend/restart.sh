#!/bin/bash
# Frontend 서버 재시작 스크립트
#
# 호스트에 미리 설치돼 있는 ktb-frontend systemd 유닛을 재시작한다.
# 유닛 등록은 호스트 프로비저닝의 책임이고 배포 경로 밖에 있으므로,
# 노드를 늘려도 배포 절차는 그대로다.

set -e

SERVICE="${SERVICE:-ktb-frontend.service}"
SERVER_JS="apps/frontend/server.js"
HEALTH_URL="http://localhost:3000/"
HEALTH_TIMEOUT=30

if ! systemctl cat "$SERVICE" >/dev/null 2>&1; then
    echo "❌ systemd 유닛 $SERVICE 없음 — 이 호스트는 앱 서버로 프로비저닝되지 않았습니다"
    exit 1
fi

if [ ! -f "$SERVER_JS" ]; then
    echo "❌ $SERVER_JS 없음 — 빌드 산출물이 배포되지 않았습니다"
    exit 1
fi

echo "🔄 Restarting $SERVICE..."
sudo systemctl restart "$SERVICE"

echo "⏳ Waiting for server to respond..."
elapsed=0
while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
    if curl -sf -o /dev/null "$HEALTH_URL"; then
        echo "✅ Server started successfully!"
        echo "📋 Logs: journalctl -u $SERVICE -f"
        exit 0
    fi

    # 유닛이 죽었으면 타임아웃까지 기다리지 않는다
    if ! systemctl is-active --quiet "$SERVICE"; then
        echo "❌ Service stopped while starting up"
        echo "📋 journalctl -u $SERVICE -n 50 --no-pager"
        exit 1
    fi

    sleep 1
    elapsed=$((elapsed + 1))
    printf '.'
done

echo ""
echo "❌ Timed out after ${HEALTH_TIMEOUT}s"
echo "📋 journalctl -u $SERVICE -n 50 --no-pager"
exit 1
