# ktb-chat

NextJS와 Spring Boot 기반 채팅 애플리케이션 모노레포입니다.

## 주요 기능

### 인증 및 사용자 관리
- 이메일 기반의 사용자 인증 시스템

### 채팅 기능
- 실시간 채팅 (Socket.IO)
- 이모지 리액션
- 멘션 기능 (@사용자)
- 메시지 읽음 상태 표시
- 파일 첨부 및 공유 기능

### 채팅방 관리
- 채팅방 생성
- 실시간 참여자 상태 표시

### 파일 처리
- 이미지, PDF 파일 형식 지원
- 이미지 미리보기 기능
- 안전한 파일 업로드 및 다운로드
- 파일 크기 제한 (5MB)

## 개발 환경 사전 요구사항

로컬 개발을 시작하기 전에 아래 도구가 **직접 설치**되어 있어야 합니다.
(JDK·Maven·MongoDB·Redis·`.env` 등은 아래 "개발 서버 실행" 과정에서
자동으로 준비되므로 별도로 설치할 필요가 없습니다 — [자동으로 준비되는 항목](#자동으로-준비되는-항목-직접-설치-불필요) 참고.)

| 도구 | 버전 | 용도 |
|------|------|------|
| **Docker** | Desktop 또는 Engine, **데몬 실행 상태** | 백엔드 개발 시 MongoDB·Redis를 Testcontainers로 자동 기동, 모니터링 스택(Prometheus·Grafana) 구동 |
| **Node.js** | 20 이상 (LTS 권장) | 프론트엔드(Next.js 16 / React 19) 및 E2E/부하테스트 실행 |
| **pnpm** | `pnpm-lock.yaml` 과 호환되는 버전 | 의존성 설치 및 스크립트 실행. `corepack enable` 로 활성화하거나 `npm i -g pnpm` 으로 설치 |
| **make** | OS 기본 제공 | 루트에서 개발 환경 준비 및 서버 실행 (`make dev`, `make dev-lan`). macOS 는 Xcode Command Line Tools, Linux 는 `build-essential` 에 포함 |

> **Docker 데몬은 반드시 실행 중이어야 합니다.** 백엔드 `make dev` 는
> Testcontainers 로 MongoDB·Redis 를 컨테이너로 띄우기 때문에, Docker 가
> 없거나 데몬이 꺼져 있으면 기동에 실패합니다. `make verify-docker` 로
> 설치·구동 여부를 미리 확인할 수 있습니다.

### 자동으로 준비되는 항목 (직접 설치 불필요)

- **JDK 25 / Maven** — 백엔드 `make setup-java` 가 SDKMAN 으로 Java 25 를
  설치하고, Maven 은 `./mvnw` 래퍼가 필요한 버전을 자동으로 내려받습니다.
- **MongoDB 8 / Redis 8** — 백엔드 `make dev` 가 Docker 기반
  Testcontainers 로 자동 기동합니다. (별도 로컬 설치 불필요)
- **`.env` / `.env.local`** — 루트 `make setup` 이 백엔드 `.env`와 프론트엔드
  `.env.local`을 준비합니다. 백엔드의 `JWT_SECRET`·`ENCRYPTION_KEY`·
  `ENCRYPTION_SALT`는 자동 생성됩니다.
- **의존성** — `pnpm install` 로 `node_modules` 와 `concurrently` 가
  설치됩니다.

## 환경 변수 설정

`.env` 계열은 `.gitignore` 대상이라 clone 직후에는 없지만, `make setup`,
`make dev`, `make dev-lan` 실행 시 템플릿에서 **자동 생성**하므로 직접 만들
필요는 없습니다.

- 백엔드 `apps/backend/.env` — `make dev` 가 `.env.template` 에서 생성 (시크릿 자동 생성)
- 프론트엔드 `apps/frontend/.env.local` — `dev:frontend` 가 `.env.example` 에서 생성

기본값은 모두 로컬 실행 기준입니다. 백엔드를 다른 호스트에 띄우는 등
기본값을 바꿔야 할 때만 아래 프론트엔드 값을 수정하세요. (이미 `.env.local`
이 있으면 자동 생성이 덮어쓰지 않습니다.)

| 변수 (`apps/frontend/.env.local`) | 설명 |
|------|------|
| `NEXT_PUBLIC_API_URL` | 백엔드 REST API 주소 (기본 `http://localhost:5001`) |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO 주소 (기본 `http://localhost:5002`) |

## 개발 서버 실행

루트에서 다음 명령 하나로 의존성과 환경 파일을 준비하고 프론트엔드와 백엔드를
동시에 실행합니다.

```bash
make dev
```

기존 `pnpm run dev`도 계속 사용할 수 있습니다. 환경 준비만 먼저 수행하려면
`make setup`을 실행하세요.

### 같은 LAN 또는 로컬 컨테이너에서 접근

LoadHarbor, 같은 네트워크의 다른 장비 또는 로컬 컨테이너에서 개발 서버로
요청을 보내려면 LAN 모드로 실행합니다.

```bash
make dev-lan
```

`dev-lan`은 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` 범위에서 현재
머신의 사설 IPv4를 찾아 Next.js 개발 origin과 프론트엔드의 API/Socket.IO
주소에 주입합니다. 자동 탐지 결과는 다음 명령으로 확인할 수 있습니다.

```bash
make detect-private-ip
```

VPN이나 여러 네트워크 인터페이스 때문에 다른 주소가 선택되면 직접 지정할 수
있습니다.

```bash
make dev-lan DEV_HOST=172.16.0.10
```

LAN 모드는 개발 서버를 네트워크에 노출하므로 신뢰할 수 있는 네트워크에서만
사용하세요. 개인 IP는 설정 파일에 기록되거나 Git에 커밋되지 않습니다.

## 테스트 실행

이 레포는 **부하테스트**가 목적이라, 루트에는 그와 직접 관련된 스위트만 노출합니다.
(프론트엔드/백엔드 단위 테스트는 각 앱 디렉터리에서 `pnpm --dir apps/frontend test`,
`cd apps/backend && make test`로 개별 실행할 수 있습니다.)

| 스크립트 | 대상 | 용도 |
|------|------|------|
| `pnpm run test:e2e` | `e2e/` | 실제 브라우저로 로그인·채팅·프로필 플로우가 **정상 동작하는지** 검증하는 기능/회귀 테스트 (Playwright) |
| `pnpm run test:artillery` | `e2e/artillery` | 실제 브라우저를 다수 띄워 **부하**를 주는 테스트 (Artillery + Playwright 엔진) |

`test:e2e`는 "행동이 맞게 동작하는가"를 보는 기능 테스트입니다. `test:artillery`의 시나리오는
`e2e/actions`에 있는 것과 **같은** 사용자 행위 함수(로그인, 채팅 등)를 재사용하므로, `test:e2e`가
통과해야 `test:artillery`가 재현하는 행동도 신뢰할 수 있습니다.

두 스위트 모두 대상 서버를 `BASE_URL` 환경 변수로 지정합니다. **기본값은 로컬이 아니라
배포 서버**(`e2e/.env`, `e2e/artillery/Makefile`)이므로, 로컬 `pnpm run dev` 서버를 대상으로
할 때는 명시적으로 넘겨야 합니다:

```bash
BASE_URL=http://localhost:3000 pnpm run test:artillery
```
