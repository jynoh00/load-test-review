# Frontend 배포 가이드

## 🚀 새로운 배포 워크플로우

### 개요
로컬에서 빌드한 결과물을 서버로 전송하고, 서버에서는 재시작만 하는 방식으로 배포합니다.

### 장점
- ✅ 서버 리소스 절약 (빌드를 로컬에서 수행)
- ✅ 빠른 배포 (서버에서 빌드 시간 제거)
- ✅ 서버에 전체 node_modules 불필요
- ✅ 롤백 용이 (빌드 결과물 보관 가능)

---

## 📋 배포 프로세스

### 1. 로컬에서 배포 실행
```bash
cd apps/frontend
make deploy
```

### 2. 자동으로 수행되는 작업

#### 로컬 (빌드 단계)
1. `pnpm run build:production` 실행
   - Next.js 빌드 수행
   - static 파일을 standalone 디렉토리로 복사
   - public 파일을 standalone 디렉토리로 복사

#### 서버로 전송 (배포 단계)
2. 빌드 결과물만 서버로 전송
   - `.next/standalone/` → 서버의 배포 디렉토리
   - `.next/static` → 서버의 `.next/static`
   - `public` → 서버의 `public`
   - `restart.sh` → 서버의 `restart.sh`

#### 서버 (재시작 단계)
3. 서버에서 `restart.sh` 실행
   - 기존 프로세스 종료
   - 새로운 standalone 서버 시작
   - 서버 시작 확인

---

## 🔧 사용 가능한 명령어

### 로컬 빌드만 수행
```bash
make build-local
```

### 전체 배포 (빌드 + 전송 + 재시작)
```bash
make deploy
```

### 특정 서버에만 배포
```bash
DEPLOY_SERVERS="your-frontend-server1 your-frontend-server2" make deploy
```

### 배포 경로 변경
```bash
DEPLOY_PATH=/custom/path make deploy
```

---

## 📁 배포되는 파일 구조

서버에 배포되는 디렉토리 구조:
```
/home/ubuntu/ktb-chat-frontend/
├── .next/
│   ├── static/          # 정적 리소스 (CSS, JS 등)
│   └── standalone/
│       └── server.js    # Next.js standalone 서버
├── public/              # 공개 정적 파일
├── node_modules/        # 최소한의 런타임 dependencies (standalone에 포함)
├── package.json         # 패키지 정보
├── restart.sh           # 서버 재시작 스크립트
└── app.log              # 서버 로그

```

---

## 🔍 트러블슈팅

### 배포 실패 시 체크리스트
1. SSH 접속 확인
   ```bash
   ssh your-frontend-server1 "echo 'Connection OK'"
   ```

2. 서버 디스크 공간 확인
   ```bash
   ssh your-frontend-server1 "df -h"
   ```

3. 서버 로그 확인
   ```bash
   ssh your-frontend-server1 "cd /home/ubuntu/ktb-chat-frontend && tail -100 app.log"
   ```

### 서버에서 수동 재시작
```bash
ssh your-frontend-server1
cd /home/ubuntu/ktb-chat-frontend
./restart.sh
```

### 서버 상태 확인
```bash
ssh your-frontend-server1 "ps aux | grep 'node .next/standalone/server.js'"
```

---

## 📊 기존 vs 새로운 워크플로우 비교

| 항목 | 기존 방식 | 새로운 방식 |
|------|-----------|-------------|
| 빌드 위치 | 서버 | 로컬 |
| 전송 용량 | 소스코드 전체 | 빌드 결과물만 |
| 서버 리소스 | 높음 (빌드) | 낮음 (실행만) |
| 배포 시간 | 느림 (빌드 포함) | 빠름 (전송+재시작) |
| node_modules | 전체 필요 | 최소한만 필요 |
| 롤백 | 어려움 | 쉬움 |

---

## 📝 관련 파일

- `package.json`: 빌드 스크립트 정의
- `Makefile`: 배포 자동화 스크립트
- `restart.sh`: 서버 재시작 스크립트
- `next.config.js`: Next.js standalone 출력 설정
