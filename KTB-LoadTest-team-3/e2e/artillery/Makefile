###################################
# Environment Variables
###################################
# Artillery가 부하를 주는 대상 URL
export BASE_URL ?= http://localhost:3000

# 대량 채팅발송 시, 발송되는 메시지 갯수
export MASS_MESSAGE_COUNT ?= 10

# 각 Scenario 중간의 Action에 대한 Timeout 설정 (밀리초 단위)
export ACTION_TIMEOUT ?= 1000
export ACTION_TIMEOUT_SHORT ?= 500
export ACTION_TIMEOUT_LONG ?= 2000

# 금칙어 목록 (쉼표로 구분)
export FORBIDDEN_WORDS ?= "b3sig78jv,9c0hej6x,lbl276sz"

# Artillery에서 부하테스트 설정
export PHASE1_DURATION ?= 5 # 해당 시간 내에
export PHASE1_ARRIVAL_COUNT ?= 1 # 몇명의 가상 유저를 생성할건지?

.PHONY: verify-env artillery

verify-env:
	# Check Node.js installed
	@command -v node 2>&1 || { echo >&2 "❌ Node.js is not installed. Please install Node.js to proceed."; exit 1; }

	# Check pnpm installed
	@command -v pnpm 2>&1 || { echo >&2 "❌ pnpm is not installed. Run 'corepack enable' or 'npm i -g pnpm' to install it."; exit 1; }

	# Check Artillery Package Installed
	@pnpm --filter e2e list artillery 2>&1 || { echo >&2 "❌ Artillery is not installed. Run 'pnpm install' from the repo root to install it."; exit 1; }

	# Ensure Chromium is downloaded regardless of how build scripts were skipped
	# (old pnpm ignoring allowBuilds, --ignore-scripts, a global pnpm bypassing corepack, etc.)
	@pnpm --filter e2e exec playwright install chromium

artillery: verify-env
	@echo "🚀 Running basic head test ($(PHASE1_ARRIVAL_COUNT) users for $(PHASE1_DURATION)s)..."
	@pnpm --filter e2e exec artillery run artillery/artillery-config.yaml