# Chat App Frontend

Next.js 기반의 실시간 채팅 애플리케이션 프론트엔드입니다.

## 기술 스택

- **Framework**: Next.js 16.2.9
- **UI Library**: React 19.2.7
- **Styling**: Tailwind CSS 4.0, Vapor UI Design System
- **Real-time Communication**: Socket.IO Client 4.8.3

## 사전 요구사항

- Node.js 20.x 이상 (Next.js 16 요구사항)
- pnpm (`corepack enable` 로 활성화하거나 `npm i -g pnpm` 으로 설치)

## 설치 및 실행

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

로컬 개발은 `.env.local`을 사용합니다. `.env.example`을 복사해 만드세요
(리포 루트에서 `pnpm run dev`를 쓰면 없을 때 자동 생성됩니다):

```bash
cp .env.example .env.local
```

`.env.local` 파일 내용:

```env
PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_SOCKET_URL=http://localhost:5002
```

> `.env.local`은 프로덕션 빌드(`build:production`)에서도 `.env.production`보다
> 우선 적용됩니다. 배포용 빌드 전에 로컬 값이 섞여 들어가지 않았는지 확인하세요.

**환경 변수 설명:**
- `NEXT_PUBLIC_API_URL`: 백엔드 REST API 서버 주소
- `NEXT_PUBLIC_SOCKET_URL`: Socket.IO 서버 주소

서버환경에서 실행시 Route 53 에 등록한 도메인을 입력하세요. 예: `https://chat.goorm-ktb-[번호].goorm.team`

### 3. 개발 서버 실행

```bash
pnpm run dev
```

개발 서버가 [http://localhost:3000](http://localhost:3000)에서 실행됩니다.

포트를 바꾸려면 `.env.local`의 `PORT`를 고친 뒤 **리포 루트에서** `pnpm run dev`로 실행하세요.
`next dev`는 `.env.local`의 `PORT`를 서버 포트로 쓰지 않기 때문에, 루트 스크립트가 그 값을
읽어 셸 환경 변수로 넘겨줍니다. 이 디렉터리에서 직접 실행하면 3000으로 고정됩니다.

### 4. 프로덕션 빌드

```bash
# 빌드
pnpm run build

# 프로덕션 서버 실행
pnpm run start
```

## 빌드 및 배포

### Makefile을 사용한 배포

프로젝트는 `Makefile`을 통해 빌드 및 배포를 자동화합니다.

#### 로컬 빌드

로컬에서 프로덕션 빌드를 생성합니다:

```bash
make build-local
```

이 명령은 다음을 수행합니다:
- `pnpm run build:production` 실행
- Next.js standalone 빌드 생성

#### 원격 서버 배포

빌드된 애플리케이션을 원격 서버에 배포합니다:

```bash
make deploy
```

**기본 설정:**
- 배포 대상 서버: `your-frontend-server1`
- 배포 경로: `/home/ubuntu/ktb-chat-frontend`

**커스텀 배포 설정:**

```bash
# 여러 서버에 동시 배포
make deploy DEPLOY_SERVERS="your-frontend-server1 your-frontend-server2 your-frontend-server3"

# 다른 경로에 배포
make deploy DEPLOY_PATH=/opt/ktb-chat-frontend
```

## Docker로 실행

### Docker 이미지 빌드

```bash
docker build -t chat-app-frontend .
```

> **참고**: `NEXT_PUBLIC_*` 환경 변수는 빌드 시점에 코드에 인라인됩니다.
> - 로컬 개발: `.env.local` 파일 사용
> - 프로덕션: `.env.production` 파일 사용
>
> `.env.production`은 커밋되지 않으므로 프로덕션 빌드(`pnpm run build:production`)
> 전에 템플릿에서 만들고 배포 주소로 값을 고치세요.
>
> ```bash
> cp .env.production.example .env.production
> ```

### Docker 컨테이너 실행

```bash
docker run -p 3000:3000 chat-app-frontend
```

## 프로젝트 구조

App Router(`app/`)와 Pages Router(`pages/`)를 함께 쓰는 전환 중 구조입니다.
채팅 화면은 App Router로 옮겨졌고, 인증·프로필 화면은 아직 Pages Router에 있습니다.

```
frontend/
├── app/               # App Router (채팅 화면)
│   ├── chat/
│   │   ├── [room]/page.js  # 동적 채팅방 페이지
│   │   └── page.js         # 채팅방 목록
│   ├── login/page.js       # `/` 로 보내는 호환 라우트
│   ├── layout.js
│   ├── not-found.js
│   └── providers.js
├── pages/             # Pages Router (인증·프로필)
│   ├── chat/
│   │   └── new.js     # 새 채팅방 생성
│   ├── index.js       # 로그인 페이지
│   ├── register.js    # 회원가입 페이지
│   └── profile.js     # 프로필 페이지
├── components/        # 재사용 가능한 React 컴포넌트
│   ├── ChatHeader.js
│   ├── ChatInput.js
│   ├── ChatMessages.js
│   └── ...
├── contexts/          # React Context (전역 상태)
│   └── AuthContext.js
├── features/          # 도메인별 기능 모듈
│   └── chat/
│       ├── room/      # 채팅방 훅 및 뷰
│       └── rooms/     # 채팅방 목록 뷰
├── hooks/             # 공통 커스텀 훅
│   ├── useAutoScroll.js
│   ├── useInfiniteScroll.js
│   └── useScrollRestoration.js
├── lib/               # API·인증·소켓 클라이언트 계층
│   ├── api/           # HTTP 클라이언트 및 에러 타입
│   ├── auth/          # 토큰 저장소 및 세션
│   └── socket/        # Socket.IO 클라이언트 및 훅
├── public/            # 정적 파일
│   └── images/
├── services/          # API 및 외부 서비스
│   ├── authService.js
│   ├── fileService.js
│   └── socket.js
├── styles/            # 전역 스타일
│   └── globals.css
├── test/              # Vitest 설정 및 목
└── utils/             # 유틸리티 함수
    └── colorUtils.js
```

## 주요 기능

- **실시간 채팅**: Socket.IO를 통한 실시간 메시지 송수신
- **파일 공유**: 이미지 및 파일 업로드/다운로드
- **이모지 반응**: 메시지에 이모지 반응 추가
- **멘션 기능**: @username으로 사용자 멘션
- **읽음 상태**: 메시지 읽음/안 읽음 표시
- **프로필 관리**: 사용자 프로필 이미지 및 정보 수정
- **채팅방 관리**: 채팅방 생성, 참여, 나가기

## 페이지 라우팅

| 경로 | 화면 | 라우터 |
|------|------|--------|
| `/` | 로그인 페이지 | Pages |
| `/login` | `/` 로 리다이렉트 (호환용) | App |
| `/register` | 회원가입 | Pages |
| `/profile` | 사용자 프로필 | Pages |
| `/chat` | 채팅방 목록 | App |
| `/chat/[room]` | 개별 채팅방 (동적 라우팅) | App |
| `/chat/new` | 새 채팅방 생성 | Pages |
