.PHONY: deploy build-local

# 배포 대상 서버 목록 — ssh alias를 공백으로 구분한 목록.
# 인벤토리 파일이 있으면 읽어서 노드가 늘어도 이 파일을 고칠 필요가 없다.
# 파일을 만드는 주체는 호스트를 프로비저닝하는 쪽이며 여기서는 알 바 아니다.
# 없으면 단일 노드로 폴백하고, DEPLOY_SERVERS=... 로 덮어쓸 수 있다.
DEPLOY_HOSTS_FILE ?= $(CURDIR)/../../.deploy-hosts
DEPLOY_SERVERS ?= $(or $(shell cat $(DEPLOY_HOSTS_FILE) 2>/dev/null),your-frontend-server1)
DEPLOY_PATH ?= /home/ubuntu/ktb-chat-frontend

# 로컬에서 프로덕션 빌드
build-local:
	@echo "🏗️  Building locally..."
	pnpm run build:production
	@echo "✅ Local build completed!"

deploy:
	@echo "📦 Deploying to remote servers..."
	@for server in $(DEPLOY_SERVERS); do \
		echo "→ Deploying to $$server..."; \
		ssh $$server "mkdir -p $(DEPLOY_PATH)"; \
		echo "  📁 Copying standalone build..."; \
		rsync -avz --delete --exclude='*.log' --exclude='.env*' --exclude="server.pid" --exclude='/package.json' .next/standalone/ $$server:$(DEPLOY_PATH)/; \
		echo "  📁 Copying static files..."; \
		rsync -avz --delete .next/static $$server:$(DEPLOY_PATH)/apps/frontend/.next/; \
		echo "  📁 Copying public files..."; \
		rsync -avz --delete public $$server:$(DEPLOY_PATH)/apps/frontend/; \
		echo "  📁 Copying restart script..."; \
		rsync -avz restart.sh $$server:$(DEPLOY_PATH)/; \
		echo "  🔄 Restarting server..."; \
		ssh $$server "cd $(DEPLOY_PATH) && chmod +x restart.sh && ./restart.sh"; \
		echo "✅ Deployment to $$server completed!"; \
	done
	@echo "✅ All deployments completed!"