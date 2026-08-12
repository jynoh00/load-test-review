# Monitoring Stack

> **Last Updated**: 2026-06-20

이 디렉토리는 KTB Chat Backend 애플리케이션의 모니터링을 위한 Prometheus와 Grafana 설정을 포함합니다.

현재 운영 검증 기준은 Java 25, Spring Boot 4.1.0, Spring Boot Actuator의 `/actuator/*` 엔드포인트입니다.

## 구성 요소

### Prometheus (v3.1.0)
- 메트릭 수집 및 저장
- 포트: 9090
- 데이터 보관 기간: 30일
- 다음 소스에서 메트릭 수집:
  - Spring Boot Actuator (`/actuator/prometheus`)
  - MongoDB Exporter (포트 9216)
  - Redis Exporter (포트 9121)
  - Node Exporter (포트 9100) - 서버 리소스 모니터링

### Grafana (v11.4.0)
- 메트릭 시각화 및 대시보드
- 포트: o11y-only Compose는 `3000`, 전체 로컬 Compose는 `9091 -> 3000`
- 기본 계정: admin / admin
- 자동 프로비저닝된 대시보드 및 데이터소스

### MongoDB Exporter (v0.47.1)
- MongoDB 메트릭 수집
- 포트: 9216
- 연결, 작업, 메모리, 락 상태 모니터링

### Redis Exporter (v1.80.0)
- Redis 메트릭 수집
- 포트: 9121
- 메모리, 키, 명령어, 캐시 히트율 모니터링

### Node Exporter (v1.8.2)
- 서버 하드웨어 및 OS 메트릭 수집
- 포트: 9100
- CPU, 메모리, 디스크, 네트워크 사용량 모니터링
- File-based Service Discovery로 동적 타겟 관리

## 시작하기

### 1. Makefile 명령어로 실행 (권장)

```bash
# 모니터링 스택 시작
make o11y-up

# 모니터링 스택 종료
make o11y-down

# 로그 확인
make o11y-logs

# 재시작
make o11y-restart

# 서버에 배포
make deploy-o11y
```

### 2. Docker Compose로 직접 실행

```bash
# 로컬 환경
cd ~/workspace/ktb-chat/apps/backend
docker compose -f docker-compose.o11y.yaml up -d

# 서버 환경
cd ~/ktb-chat/apps/backend
ENVIRONMENT=prod docker compose -f docker-compose.o11y.yaml up -d
```

`.env`에 `ENVIRONMENT=dev`가 있으면 Compose interpolation이 dev 설정을 우선합니다. 운영 설정을 검증하거나 배포할 때는 `ENVIRONMENT=prod`를 명시하세요.

### 3. 서비스 확인

**웹 인터페이스**:
- Prometheus UI: http://localhost:9090
- Grafana UI: o11y-only Compose는 http://localhost:3000, 전체 로컬 Compose는 http://localhost:9091
- Application Health: http://localhost:5001/api/health
- Spring Boot Health: http://localhost:5001/actuator/health
- Spring Boot Metrics: http://localhost:5001/actuator/metrics
- Prometheus Metrics: http://localhost:5001/actuator/prometheus

**타겟 상태 확인**:
- Prometheus Targets: http://localhost:9090/targets
- Grafana Datasources: http://localhost:3000/connections/datasources

### 4. Grafana 대시보드

Grafana에 로그인하면 `grafana/provisioning/dashboards/`의 대시보드가 자동으로
프로비저닝됩니다. 현재 제공되는 대시보드는 하나입니다.

#### Node Exporter Dashboard

**용도**: 서버 하드웨어·OS 리소스 모니터링

node-exporter가 수집한 호스트 지표를 보여줍니다 (CPU, 메모리, 디스크, 네트워크).
스크랩 대상은 `prometheus/targets/node-exporters.prod.yml`에 등록된 전 노드입니다.

**언제 사용?**
- 서버 리소스 포화 여부 확인
- 노드별 부하 분포 비교
- 용량 계획 수립

#### 대시보드 추가하기

애플리케이션·MongoDB·Redis 지표는 Prometheus에 수집되고 있지만 대시보드는
포함되어 있지 않습니다. 필요한 대시보드는 직접 만들거나
[Grafana 공식 대시보드](https://grafana.com/grafana/dashboards/)에서 가져와
`grafana/provisioning/dashboards/`에 JSON으로 두면 10초 안에 반영됩니다.

수집 중인 주요 지표 소스:

| 소스 | 엔드포인트 | 대표 지표 |
|------|-----------|----------|
| Spring Boot | `/actuator/prometheus` | HTTP 요청/응답시간, JVM heap, GC, Socket.IO 이벤트 |
| mongodb-exporter | `:9216/metrics` | 연결 수, 작업 속도, 메모리 |
| redis-exporter | `:9121/metrics` | 명령어 속도, 키 수, 캐시 히트율 |
| node-exporter | `:9100/metrics` | CPU, 메모리, 디스크, 네트워크 |

## 배포 시 주의사항

- **보안**: Grafana 기본 비밀번호를 반드시 변경하세요 (기본값: admin/admin)
- **네트워크**: EC2 보안 그룹에서 포트 9090(Prometheus), 3000(Grafana) 개방 확인
- **백업**: Prometheus 데이터는 `prometheus_data` 볼륨에 저장되므로 정기 백업 권장

## 스크랩 타겟 관리

### File-based Service Discovery

프로덕션의 app 노드 타겟은 파일 기반 서비스 디스커버리로 관리합니다.
**장점**: 파일만 갱신되면 Prometheus 재시작 없이 반영됩니다 (`refresh_interval: 5s`).

### 타겟 파일 구조

```
monitoring/prometheus/targets/
├── node-exporters.prod.yml  # OS 지표 (node-exporter, :9100)
└── backend-apps.prod.yml    # 앱 지표 (Spring Boot actuator, :5001)
```

두 파일 모두 **직접 편집**합니다. 각 노드의 private IP와 포트를 적어두면 됩니다
(앱 지표는 `:5001`, OS 지표는 `:9100`).

**참고**: 개발 환경에서는 타겟 파일이 필요하지 않습니다. 로컬에서는 Spring Boot
애플리케이션 메트릭만 수집합니다.

### 노드가 늘거나 IP가 바뀐 경우

```bash
# 1. 타겟 파일에서 해당 노드의 IP를 고친다
$EDITOR monitoring/prometheus/targets/backend-apps.prod.yml
$EDITOR monitoring/prometheus/targets/node-exporters.prod.yml

# 2. o11y 노드로 전송
make deploy-o11y
```

`targets/`는 디렉토리로 마운트돼 있고 `refresh_interval`이 5초라, rsync가 끝나면
곧 반영됩니다.

`prometheus.prod.yml`(또는 `rules.yml`)의 **잡 정의**를 고쳤다면 `/-/reload`로는
부족합니다 — 이 파일들은 **단일 파일 bind mount**라서 rsync가 새 inode로 교체하면
컨테이너는 예전 inode를 계속 붙들고 있습니다. `/-/reload`가 200을 주면서도 낡은
설정을 다시 읽습니다(2026-08-05 실측). `docker compose restart`도 컨테이너를
재생성하지 않아 같은 함정입니다:

```bash
ssh your-o11y-server 'cd ~/o11y && docker compose -f docker-compose.o11y.yaml \
  --env-file .env up -d --force-recreate prometheus'
```

Grafana 대시보드는 디렉토리 마운트라 재생성 없이 프로비저닝 주기(10초)에 반영됩니다.

로드밸런서에서 트래픽을 받는 노드가 바뀌어도 **타겟 파일에 적힌 전 노드를 항상
스크랩**합니다. 트래픽이 빠진 노드도 지표는 계속 보이고, 트래픽 0으로 구분합니다.

### 서버 그룹별 관리

역할별로 그룹을 나누어 관리할 수 있습니다:

```yaml
# Backend Cluster
- targets:
    - 'IP:9100'
    - 'IP:9100'
  labels:
    cluster: 'backend'
    service: 'api'

# Database Cluster
- targets:
    - 'IP:9100'
  labels:
    cluster: 'database'
    service: 'mongodb'

# Cache Cluster
- targets:
    - 'IP:9100'
  labels:
    cluster: 'cache'
    service: 'redis'
```

### 타겟 확인하기

Prometheus UI에서 타겟 상태를 확인할 수 있습니다:

1. http://localhost:9090/targets 접속
2. `node-exporter`·`spring-boot-app` job 섹션에서 모든 타겟 확인
3. 상태가 `UP`이면 정상, `DOWN`이면 연결 불가

CLI로 확인:

```bash
ssh your-o11y-server "curl -s 'localhost:9090/api/v1/targets?state=active'" \
  | jq -r '.data.activeTargets[] | "\(.labels.job) \(.labels.instance) \(.health)"' | sort
```

### 배포 워크플로우

```bash
# 1. 타겟 파일 수정 (monitoring/prometheus/targets/)

# 2. o11y 노드로 전송 — rsync 방식이라 서버에서 git pull 하지 않는다
make deploy-o11y

# 3. 반영 확인 (타깃 파일만 바뀌었으면 재시작 불필요, 5초 이내)
#    prometheus.prod.yml/rules.yml을 바꿨다면 컨테이너 재생성 (위 참조)

# 4. 변경 커밋 (타겟 파일도 레포에 함께 둔다)
git add apps/backend/monitoring/prometheus/targets/
git commit -m "chore(monitoring): refresh scrape targets"
```

### 라벨 활용하기

라벨을 사용하여 Grafana에서 필터링할 수 있습니다:

```yaml
- targets:
    - 'IP:9100'
  labels:
    environment: 'production'   # 환경 구분
    region: 'ap-northeast-2'    # 리전
    cluster: 'backend'          # 클러스터
    service: 'api'              # 서비스 타입
    team: 'platform'            # 담당 팀
    tier: 'critical'            # 중요도
```

Grafana 쿼리 예시:
```promql
# Backend 클러스터의 CPU 사용률
node_cpu_seconds_total{cluster="backend"}

# Critical tier 서버만 조회
node_memory_MemAvailable_bytes{tier="critical"}

# 특정 팀 담당 서버
up{team="platform"}
```

## 디렉토리 구조

```
monitoring/
├── README.md                    # 이 문서
├── prometheus/
│   ├── prometheus.dev.yml       # 개발 환경 Prometheus 설정
│   ├── prometheus.prod.yml      # 프로덕션 환경 Prometheus 설정
│   ├── rules.yml                # 알림 규칙
│   └── targets/                 # file_sd 스크랩 타겟 (직접 편집)
│       ├── node-exporters.prod.yml  # OS 지표 타겟 (:9100)
│       └── backend-apps.prod.yml    # 앱 지표 타겟 (:5001)
└── grafana/
    └── provisioning/
        ├── datasources/
        │   ├── prometheus.dev.yml   # 개발 환경 데이터소스
        │   └── prometheus.prod.yml  # 프로덕션 환경 데이터소스
        └── dashboards/
            ├── dashboard.yml        # 대시보드 프로비저닝 설정
            └── *.json               # 대시보드 정의 파일들
```


## 메트릭 엔드포인트

Spring Boot Actuator가 제공하는 주요 엔드포인트:

- `/api/health` - 애플리케이션 custom health endpoint
- `/actuator/health` - 애플리케이션 상태
- `/actuator/info` - 애플리케이션 정보
- `/actuator/metrics` - 사용 가능한 메트릭 목록
- `/actuator/prometheus` - Prometheus 형식의 메트릭

## 커스터마이징

### Prometheus 스크랩 간격 변경

`prometheus/prometheus.yml` 파일에서 `scrape_interval`을 수정하세요.

### 새로운 대시보드 추가

`grafana/provisioning/dashboards/` 디렉토리에 JSON 형식의 대시보드 파일을 추가하면 자동으로 프로비저닝됩니다.

### Grafana 관리자 비밀번호 변경

`docker-compose.o11y.yaml` 파일에서 Grafana 서비스의 환경 변수를 수정하세요:

```yaml
environment:
  - GF_SECURITY_ADMIN_PASSWORD=새로운_비밀번호
```

## 문제 해결

### Prometheus가 Spring Boot 앱에서 메트릭을 수집하지 못하는 경우

1. Spring Boot 애플리케이션이 실행 중인지 확인
2. `http://localhost:5001/actuator/prometheus`에서 메트릭이 노출되는지 확인
3. Docker 네트워크 설정 확인 (host.docker.internal)
4. 개발 Prometheus 설정에는 `cadvisor:8080` scrape target이 있지만 현재 로컬 Compose에는 cAdvisor 서비스가 없습니다. 해당 target은 별도 cAdvisor를 띄우기 전까지 DOWN일 수 있습니다.

### Grafana 대시보드가 표시되지 않는 경우

1. Grafana 로그 확인: `docker logs grafana-ktb`
2. 데이터소스가 올바르게 설정되었는지 확인
3. Prometheus에서 데이터가 수집되고 있는지 확인
4. `monitoring/grafana/provisioning/dashboards/`에 JSON 대시보드가 있는지 확인

## 데이터 볼륨

메트릭 데이터는 Docker 볼륨에 영구 저장됩니다:

- `prometheus_data` - Prometheus 시계열 데이터
- `grafana_data` - Grafana 설정 및 대시보드

볼륨 삭제 시 모든 데이터가 손실됩니다:
```bash
docker compose -f docker-compose.o11y.yaml down -v
```

## 운영 검증과 롤백

Boot 4 전환 후 운영 검증은 다음 명령으로 수행합니다.

```bash
cd ~/workspace/ktb-chat/apps/backend
docker compose config
ENVIRONMENT=prod docker compose -f docker-compose.o11y.yaml config
./mvnw -DskipTests package
curl http://localhost:5001/actuator/health
curl http://localhost:5001/actuator/prometheus
```

운영 문제가 확인되면 먼저 모니터링 스택만 내리고 애플리케이션 상태를 확인합니다.

```bash
docker compose -f docker-compose.o11y.yaml down
./app-control.sh status
curl http://localhost:5001/actuator/health
```

애플리케이션 롤백은 직전 정상 JAR 또는 직전 정상 Docker 이미지 태그로 되돌린 뒤 재시작합니다.

```bash
cp target/ktb-chat-backend-previous.jar target/ktb-chat-backend-0.0.1-SNAPSHOT.jar
./app-control.sh restart
docker run --rm -p 5001:5001 -p 5002:5002 ktb-chat-backend:previous
```
