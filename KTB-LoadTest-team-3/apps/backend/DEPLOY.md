# KTB Chat Backend 배포 가이드

## 📋 목차

- [배포](#배포)
- [서버 환경 설정](#서버-환경-설정)
- [배포 프로세스](#배포-프로세스)
- [애플리케이션 관리](#애플리케이션-관리)
- [문제 해결](#문제-해결)
- [모니터링 스택 (Observability) 배포](#모니터링-스택-observability-배포)
- [SSH Alias 설정](#ssh-alias-설정)

---

## 배포

### 1. 로컬에서 빌드

```bash
cd apps/backend

# 테스트 제외 (빠른 빌드)
make build-jar

# 또는 테스트 포함 (프로덕션 배포 전 권장)
make build-jar-with-tests
```

**빌드 결과:**
```
target/ktb-chat-backend-0.0.1-SNAPSHOT.jar
```

### 2. 서버로 배포

```bash
make deploy-jar
```

**배포 대상 설정:**

배포 대상은 리포 루트의 `.deploy-hosts`에서 읽습니다. 이 파일은 커밋되지 않으므로
템플릿을 복사해 자신의 SSH alias로 채우세요. (한 줄에 공백으로 구분)

```bash
cp .deploy-hosts.example .deploy-hosts
```

```bash
# 파일 없이 이번 실행만 대상 지정
DEPLOY_SERVERS="your-backend-server1 your-backend-server2" make deploy-jar

# 배포 경로 변경
DEPLOY_PATH="/opt/ktb-chat" make deploy-jar
```

`.deploy-hosts`가 없으면 백엔드는 `your-backend-server1`,
프론트엔드는 `your-frontend-server1`로 기본 설정됩니다 — 실제 접속 가능한
호스트가 아니므로 반드시 위 둘 중 한 방법으로 지정해야 합니다.

**배포되는 파일:**
- `target/ktb-chat-backend-0.0.1-SNAPSHOT.jar`
- `app-control.sh` (애플리케이션 관리 스크립트)
- `.env` (존재하는 경우, 서버에 없을 때만)

### 3. 서버에서 실행

```bash
# 서버 SSH 접속
ssh your-backend-server1

# 애플리케이션 디렉토리 이동
cd /home/ubuntu/ktb-chat-backend

# 애플리케이션 시작
./app-control.sh start

# 상태 확인
./app-control.sh status

# 로그 확인
tail -f logs/app.log
```

---

## 서버 환경 설정

### 사전 요구사항

1. **Java 25 설치**
   ```bash
   java -version
   # openjdk version "25.0.x"
   ```

2. **.env 파일 설정** (최초 1회)
   ```bash
   cd /home/ubuntu/ktb-chat-backend

   # .env.template을 복사하여 .env 생성
   cp .env.template .env

   # .env 파일 편집
   nano .env
   ```

   **필수 환경 변수:**
   ```bash
   # 보안 키 (openssl rand -hex 32/64)
   JWT_SECRET=your_jwt_secret_here
   ENCRYPTION_KEY=your_encryption_key_64_hex_chars
   ENCRYPTION_SALT=your_encryption_salt_32_hex_chars

   # 데이터베이스
   MONGO_URI=mongodb://localhost:27017/bootcamp-chat
   REDIS_HOST=localhost
   REDIS_PORT=6379

   # 서버 포트
   PORT=5001
   WS_PORT=5002

   # OpenAI API
   OPENAI_API_KEY=sk-...
   ```

3. **MongoDB 및 Redis 실행 확인**
   ```bash
   # MongoDB 상태 확인
   systemctl status mongodb

   # Redis 상태 확인
   systemctl status redis
   ```

### Docker 런타임

컨테이너 배포 경로는 Java 25 이미지를 사용합니다.

```bash
docker build -t ktb-chat-backend:java25 .
docker image inspect ktb-chat-backend:java25 --format '{{json .Config.ExposedPorts}}'
```

노출 포트:

- `5001/tcp`: HTTP API, Swagger UI, Actuator endpoints
- `5002/tcp`: Socket.IO server

### 디렉토리 구조

```
/home/ubuntu/ktb-chat-backend/
├── target/
│   └── ktb-chat-backend-0.0.1-SNAPSHOT.jar
├── logs/
│   ├── app.log
│   └── app.log.20231201_120000.gz
├── app-control.sh
├── app.pid
└── .env
```

---

## 배포 프로세스

### 전체 배포 플로우

```bash
# 1. 로컬에서 빌드
cd apps/backend
make build-jar

# 2. 서버로 배포
make deploy-jar

# 3. 서버에서 애플리케이션 재시작
ssh your-backend-server1 "cd /home/ubuntu/ktb-chat-backend && ./app-control.sh restart"

# 4. 배포 확인
ssh your-backend-server1 "cd /home/ubuntu/ktb-chat-backend && ./app-control.sh status"
```

### 원클릭 배포 스크립트 (선택)

**로컬에 `deploy.sh` 생성:**
```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# 빌드
echo "📦 Building JAR..."
make build-jar

# 배포
echo "🚢 Deploying to servers..."
make deploy-jar

# 재시작
echo "♻️  Restarting application..."
for server in your-backend-server1; do
    ssh $server "cd /home/ubuntu/ktb-chat-backend && ./app-control.sh restart"
done

echo "✅ Deployment completed!"
```

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 애플리케이션 관리

### app-control.sh 사용법

#### 시작
```bash
./app-control.sh start
```

**JVM 옵션 커스터마이징:**
```bash
# 힙 메모리 2GB 할당
JVM_OPTS="-Xmx2048m -Xms1024m" ./app-control.sh start

# 여러 JVM 옵션 설정
JVM_OPTS="-Xmx2048m -XX:+UseG1GC -XX:MaxGCPauseMillis=200" ./app-control.sh start
```

**Spring Profile 설정:**
```bash
SPRING_PROFILE=dev ./app-control.sh start
```

#### 중지
```bash
./app-control.sh stop
```

- Graceful shutdown (최대 30초 대기)
- 30초 후에도 종료 안 되면 강제 종료

#### 재시작
```bash
./app-control.sh restart
```

#### 상태 확인
```bash
./app-control.sh status
```

**출력 예시:**
```
==========================================
  ktb-chat-backend Status
==========================================

Status: RUNNING
PID: 12345
Memory: 512.3 MB
Uptime: 2-03:45:12

Health Check: http://localhost:5001/api/health
Health Status: HEALTHY

Configuration:
  JAR: target/ktb-chat-backend-0.0.1-SNAPSHOT.jar
  Profile: prod
  JVM Options: -Xmx1024m -Xms512m
  Log: logs/app.log
  .env: Found

==========================================
```

### 로그 관리

#### 실시간 로그 확인
```bash
tail -f logs/app.log
```

#### 특정 줄 수만 확인
```bash
tail -n 100 logs/app.log
```

#### 에러 로그 필터링
```bash
grep -i error logs/app.log
grep -i exception logs/app.log
```

#### 로그 파일 로테이션
- 로그 파일이 100MB 초과 시 자동 아카이브
- 형식: `app.log.20231201_120000.gz`

---

## 문제 해결

### 애플리케이션이 시작되지 않음

**1. JAR 파일 확인**
```bash
ls -lh target/ktb-chat-backend-0.0.1-SNAPSHOT.jar
```

**2. .env 파일 확인**
```bash
cat .env
# 모든 필수 환경 변수가 설정되어 있는지 확인
```

**3. 포트 충돌 확인**
```bash
# 포트 5001, 5002 사용 중인 프로세스 확인
lsof -i :5001
lsof -i :5002

# 프로세스 종료
kill -9 <PID>
```

**4. 로그 확인**
```bash
tail -n 100 logs/app.log
```

### 헬스체크 실패

**헬스체크 엔드포인트 수동 확인:**
```bash
curl http://localhost:5001/api/health
```

**예상 응답:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-20T00:00:00Z",
  "env": "prod"
}
```

### 프로세스는 실행 중이지만 응답 없음

**1. 프로세스 상태 확인**
```bash
ps aux | grep ktb-chat-backend
```

**2. 네트워크 연결 확인**
```bash
netstat -tlnp | grep 5001
ss -tlnp | grep 5001
```

**3. 메모리 부족 확인**
```bash
free -h
dmesg | grep -i "out of memory"
```

### 배포 롤백

**이전 JAR 파일이 있는 경우:**
```bash
# 애플리케이션 중지
./app-control.sh stop

# 이전 JAR로 교체
mv target/ktb-chat-backend-0.0.1-SNAPSHOT.jar target/ktb-chat-backend-0.0.1-SNAPSHOT.jar.new
mv target/ktb-chat-backend-0.0.1-SNAPSHOT.jar.backup target/ktb-chat-backend-0.0.1-SNAPSHOT.jar

# 재시작
./app-control.sh start
```

### 좀비 프로세스 정리

```bash
# PID 파일과 실제 프로세스 불일치 시
./app-control.sh stop

# 수동으로 프로세스 찾아 종료
ps aux | grep ktb-chat-backend
kill -9 <PID>

# PID 파일 삭제
rm -f app.pid
```

---

## 모니터링 스택 (Observability) 배포

KTB Chat Backend는 Prometheus와 Grafana를 활용한 통합 모니터링 스택을 제공합니다.

자세한 내용은 [모니터링 README](./monitoring/README.md)를 참조하세요.

---

## 고급 설정

### systemd 서비스 등록 (선택)

자동 시작 및 관리를 위해 systemd 서비스로 등록할 수 있습니다.

**`/etc/systemd/system/ktb-chat.service` 생성:**
```ini
[Unit]
Description=KTB Chat Backend
After=network.target mongodb.service redis.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/ktb-chat-backend
Environment="SPRING_PROFILE=prod"
Environment="JVM_OPTS=-Xmx1024m -Xms512m"
Environment="HOSTNAME=%H"
ExecStart=/usr/bin/java -Xmx1024m -Xms512m -Dspring.profiles.active=prod -jar target/ktb-chat-backend-0.0.1-SNAPSHOT.jar
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**서비스 활성화:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable ktb-chat
sudo systemctl start ktb-chat
sudo systemctl status ktb-chat
```

---

## SSH Alias 설정

편리한 서버 접속을 위해 SSH alias를 설정할 수 있습니다.

### 설정 방법

로컬 머신의 `~/.ssh/config` 파일을 편집합니다:

```bash
nano ~/.ssh/config
```

### 설정 예시

```ssh-config
# Frontend Server
Host your-frontend-server1
    HostName <EC2-PUBLIC-DNS>
    User ubuntu
    IdentityFile ~/.ssh/your-key.pem
    StrictHostKeyChecking no

# Backend Server
Host your-backend-server1
    HostName <EC2-PUBLIC-DNS>
    User ubuntu
    IdentityFile ~/.ssh/your-key.pem
    StrictHostKeyChecking no

# Database Server
Host your-db-server
    HostName <EC2-PUBLIC-DNS>
    User ubuntu
    IdentityFile ~/.ssh/your-key.pem
    StrictHostKeyChecking no

# Observability Server (Monitoring)
Host your-o11y-server
    HostName <EC2-PUBLIC-DNS>
    User ubuntu
    IdentityFile ~/.ssh/your-key.pem
    StrictHostKeyChecking no
```

### 권한 설정

```bash
# SSH 설정 파일 권한 설정
chmod 600 ~/.ssh/config

# SSH 키 파일 권한 설정
chmod 400 ~/.ssh/your-key.pem
```

### 사용 예시

SSH alias 설정 후에는 간단하게 서버에 접속할 수 있습니다:

```bash
# 기존 방식 (긴 명령어)
ssh -i ~/.ssh/your-key.pem ubuntu@<EC2-PUBLIC-DNS>

# SSH alias 사용 (간단!)
ssh your-backend-server1
```

**배포 시 활용:**
```bash
# JAR 파일 배포
scp target/ktb-chat-backend-0.0.1-SNAPSHOT.jar your-backend-server1:/home/ubuntu/ktb-chat-backend/target/

# 애플리케이션 재시작
ssh your-backend-server1 "cd /home/ubuntu/ktb-chat-backend && ./app-control.sh restart"

# 로그 확인
ssh your-backend-server1 "tail -f /home/ubuntu/ktb-chat-backend/logs/app.log"
```

**Makefile과 함께 사용:**
```bash
# Makefile의 DEPLOY_SERVERS에서 alias 활용
make deploy-jar  # 자동으로 your-backend-server1로 배포

# 여러 서버에 동시 배포
DEPLOY_SERVERS="your-backend-server1 your-backend-server2" make deploy-jar
```

### 주의사항

- `StrictHostKeyChecking no` 옵션은 편의를 위한 설정이지만, 보안상 주의가 필요합니다
- 프로덕션 환경에서는 `StrictHostKeyChecking yes`를 사용하고 known_hosts에 서버를 등록하는 것을 권장합니다
- SSH 키 파일(`.pem`)은 절대 Git 저장소에 커밋하지 마세요

---

## 문의

배포 과정에서 문제가 발생하면 다음을 확인하세요:

1. 로그 파일: `logs/app.log`
2. 애플리케이션 상태: `./app-control.sh status`
3. 서버 리소스: `htop` 또는 `top`
4. 네트워크 연결: `curl http://localhost:5001/api/health`
