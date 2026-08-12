# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /repo

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# pnpm workspace lockfile을 사용하므로 repository root를 Docker build context로 사용한다.
RUN corepack enable && corepack prepare pnpm@11.0.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json

RUN pnpm --dir apps/frontend install --frozen-lockfile

COPY apps/frontend/.env* apps/frontend/
COPY apps/frontend/jsconfig.json apps/frontend/next.config.js apps/frontend/postcss.config.js apps/frontend/tailwind.config.js apps/frontend/
COPY apps/frontend/app apps/frontend/app
COPY apps/frontend/components apps/frontend/components
COPY apps/frontend/contexts apps/frontend/contexts
COPY apps/frontend/features apps/frontend/features
COPY apps/frontend/hooks apps/frontend/hooks
COPY apps/frontend/lib apps/frontend/lib
COPY apps/frontend/pages apps/frontend/pages
COPY apps/frontend/public apps/frontend/public
COPY apps/frontend/services apps/frontend/services
COPY apps/frontend/styles apps/frontend/styles
COPY apps/frontend/utils apps/frontend/utils

RUN pnpm --dir apps/frontend build

# Stage 2: Runner
FROM node:22-alpine AS runner
WORKDIR /app

# 보안을 위한 non-root 사용자 생성
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 필요한 파일만 복사
# (모노레포 standalone 출력이라 server.js가 apps/frontend/ 아래에 그대로 중첩되어 나온다.
#  static/public도 server.js와 같은 위치 기준으로 찾으므로 같이 중첩시켜야 한다 - deploy:static 스크립트와 동일)
COPY --from=builder /repo/apps/frontend/public ./apps/frontend/public
COPY --from=builder /repo/apps/frontend/.next/standalone ./
COPY --from=builder /repo/apps/frontend/.next/static ./apps/frontend/.next/static

# 파일 권한 설정
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "apps/frontend/server.js"]
