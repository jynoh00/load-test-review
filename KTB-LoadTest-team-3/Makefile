SHELL := /bin/bash
.ONESHELL:

.PHONY: setup dev dev-lan detect-private-ip

PNPM ?= pnpm
DEV_HOST ?=

setup:
	@command -v node >/dev/null 2>&1 || { echo "❌ Node.js is not installed" >&2; exit 1; }
	@command -v $(PNPM) >/dev/null 2>&1 || { echo "❌ pnpm is not installed. Run 'corepack enable' first" >&2; exit 1; }
	@if [ ! -x node_modules/.bin/concurrently ] || [ ! -x apps/frontend/node_modules/.bin/next ]; then \
		$(PNPM) install --frozen-lockfile; \
	else \
		echo "✅ pnpm dependencies already exist"; \
	fi
	@$(MAKE) -C apps/backend setup-env
	@if [ ! -f apps/frontend/.env.local ]; then \
		cp apps/frontend/.env.example apps/frontend/.env.local; \
		echo "✅ Created apps/frontend/.env.local"; \
	else \
		echo "✅ apps/frontend/.env.local already exists"; \
	fi

dev: setup
	@$(PNPM) run dev

detect-private-ip:
	@if [ -n "$(DEV_HOST)" ]; then \
		printf '%s\n' "$(DEV_HOST)"; \
	else \
		node scripts/detect-private-ip.js; \
	fi

dev-lan: setup
	@host="$(DEV_HOST)"; \
	if [ -z "$$host" ]; then \
		host="$$(node scripts/detect-private-ip.js)" || exit 1; \
	fi; \
	if [ -z "$$host" ]; then \
		echo "❌ private IP를 확정하지 못했습니다. make dev-lan DEV_HOST=<private-ip> 로 지정하세요" >&2; \
		exit 1; \
	fi; \
	echo "🚀 Starting LAN development server"; \
	echo "   Frontend:  http://$$host:3000"; \
	echo "   API:       http://$$host:5001"; \
	echo "   Socket.IO: http://$$host:5002"; \
	DEV_ALLOWED_ORIGINS="$$host,host.docker.internal" \
	NEXT_PUBLIC_API_URL="http://$$host:5001" \
	NEXT_PUBLIC_SOCKET_URL="http://$$host:5002" \
	$(PNPM) run dev
