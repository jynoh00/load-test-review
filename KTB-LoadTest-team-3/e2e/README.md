# E2E 테스트

채팅 애플리케이션의 E2E 테스트 코드입니다.

## 디렉토리 구조

```
e2e/
├── actions/          # 사용자 행위 함수 (클릭, 입력 등)
├── tests/            # E2E 테스트 케이스
├── artillery/        # Artillery + Playwright 부하 테스트 시나리오
├── fixtures/         # 테스트용 파일 (이미지, PDF 등)
├── playwright.config.js
└── package.json
```

## actions/

사용자 행위를 수행하는 함수들입니다. 검증 로직 없이 순수한 동작만 포함합니다.

**auth.actions.js**
```javascript
async function loginAction(page, credentials) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByTestId('login-email-input').fill(credentials.email);
  await page.getByTestId('login-password-input').fill(credentials.password);
  await page.getByTestId('login-submit-button').click();
}
```

**포함 기능**:
- `auth.actions.js` - 로그인, 회원가입, 로그아웃
- `chat.actions.js` - 채팅방 생성, 입장, 메시지 전송
- `profile.actions.js` - 프로필 조회, 수정

## tests/

E2E 테스트 케이스입니다. actions 함수를 사용하여 동작을 수행하고 결과를 검증합니다.

**auth.spec.js**
```javascript
test('올바른 계정 정보로 로그인 성공', async ({ page }) => {
  await loginAction(page, testUser);
  await expect(page).toHaveURL(`${BASE_URL}/chat`);
});
```

**테스트 파일**:
- `auth.spec.js` - 인증 관련 테스트
- `chat.spec.js` - 채팅 기능 테스트
- `profile.spec.js` - 프로필 기능 테스트
- `timeout.spec.js` - 응답 지연·드롭 시 프론트엔드 타임아웃 판정 시점 계측

## artillery/

actions 함수를 재사용하는 Artillery + Playwright 부하 테스트 시나리오입니다.
실행 방법과 환경 변수는 [artillery/README.md](artillery/README.md)를 참고하세요.

## 실행 방법

### 테스트 실행

```bash
# 로컬 프론트엔드 smoke 테스트 실행
pnpm test

# 전체 풀스택 테스트 실행
pnpm run test:full

# 특정 파일만 실행
pnpm exec playwright test tests/auth.spec.js

# UI 모드 (디버깅용)
pnpm run test:ui

# 헤드풀 모드 (브라우저 UI 표시)
pnpm exec playwright test --headed
```

### vscode extension

Playwright Test for VSCode 확장 프로그램을 설치하여 IDE 내에서 테스트를 실행하고 디버깅할 수 있습니다.


### 환경 변수

```bash
# 로컬 환경
BASE_URL=http://127.0.0.1:3000 pnpm test

# 다른 환경
BASE_URL=https://example.com pnpm run test:full
```

기본 `pnpm test`는 `@smoke` 테스트만 실행합니다. 백엔드와 테스트 계정이 필요한 전체 시나리오는 `pnpm run test:full`로 실행합니다.

> **대상 서버 주의.** `playwright.config.js`가 `e2e/.env`를 읽으므로 **기본 대상은 로컬이 아니라 배포 서버**입니다. 로컬을 대상으로 하려면 `BASE_URL`을 직접 넘기세요. `BASE_URL`이 `localhost`/`127.0.0.1`일 때만 Playwright가 프론트엔드 dev server를 자동으로 띄웁니다.

## fixtures/

테스트에 사용되는 고정 파일입니다.

- `images/profile.jpg` - 프로필 이미지 업로드 테스트용
- `pdf/sample.pdf` - 파일 업로드 테스트용

## 테스트 데이터

### data-testid

모든 UI 요소는 `data-testid` 속성으로 식별합니다.  
절대 testid를 수정하지 마세요.

### 동적 데이터 생성

테스트 실행 시 고유한 데이터를 자동 생성합니다.

```javascript
const testUser = {
  email: `testuser_${Date.now()}@example.com`,
  password: 'Password123!',
  name: 'Test User',
};
```
