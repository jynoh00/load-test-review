const path = require('path');
const { test, expect } = require('@playwright/test');
const { loginAction, registerAction, logoutAction } = require('../actions/auth.actions');
const {
  joinFirstChatRoomAction,
  joinRandomChatRoomAction,
  createChatRoomAction,
  sendMessageAction,
  sendMultipleMessagesAction,
  uploadFileAction,
  scrollChatToTopAction,
  addEmojiReactionAction,
} = require('../actions/chat.actions');
const { bannedWordSafeToken } = require('../utils/bannedWordSafeText');

const fs = require('fs');
const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const USER_COUNT = 5;
const IMAGE_FIXTURE_PATH = path.resolve(__dirname, '../fixtures/images/profile.jpg');
const IMAGE_FIXTURE_SIZE = fs.statSync(IMAGE_FIXTURE_PATH).size;

/**
 * img 요소가 실제로 디코딩까지 끝냈는지 읽는다.
 * 첨부 이미지는 로드에 실패하면 프론트가 src를 placeholder로 갈아끼우므로,
 * src가 존재하는 것만으로는 이미지가 떴다고 말할 수 없다.
 */
const readImageState = (locator) =>
  locator.evaluate((img) => ({
    src: img.currentSrc || img.src,
    complete: img.complete,
    naturalWidth: img.naturalWidth,
  }));

const sha256OfFile = (filePath) =>
  crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

// 유틸리티 함수
const generateUniqueId = () => Math.random().toString(36).substring(2, 8);
const generateRandomMessage = () => bannedWordSafeToken();

// 부하기에서 다른 금칙어로 교체
const FORBIDDEN_WORDS = ['b3sig78jv', '9c0hej6x', 'lbl276sz', 'p4e84', 'hy8m', 'ikqy2y'];
const getRandomForbiddenWord = () => FORBIDDEN_WORDS[Math.floor(Math.random() * FORBIDDEN_WORDS.length)];

const createTestUser = (index, testId) => ({
  email: `chattest${index}_${testId}_${generateUniqueId()}@example.com`,
  password: 'Password123!',
  passwordConfirm: 'Password123!',
  name: `Chat Test User ${index}`,
});

test.describe('채팅 smoke', () => {
  test('@smoke 비로그인 사용자를 로그인 화면으로 보낸다', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);

    await expect(page).toHaveURL(new RegExp(`^${BASE_URL}/`));
    await expect(page.getByTestId('login-email-input')).toBeVisible({ timeout: 6000 });
  });
});

test.describe.serial('채팅 E2E 테스트', () => {
  let testUsers = [];

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const testId = Date.now();

    // 사용자 데이터 생성
    testUsers = Array.from({ length: USER_COUNT }, (_, i) => createTestUser(i + 1, testId));

    // 순차적으로 회원가입 진행
    for (const [index, user] of testUsers.entries()) {
      await registerAction(page, user);
      await loginAction(page, user);
      await page.waitForTimeout(1000);

      const isLastUser = index === testUsers.length - 1;
      if (!isLastUser) {
        await page.goto(`${BASE_URL}/chat`);
        await logoutAction(page);
        await page.waitForTimeout(500);
      }
    }

    await page.close();
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAction(page, testUsers[0]);
    await expect(page).toHaveURL(`${BASE_URL}/chat`);
  });

  test.describe('채팅방 관리', () => {
    test('새 채팅방 만들기', async ({ page }) => {
      const roomName = `테스트_채팅방_${Math.random().toString(36).substring(2, 8)}`;

      // 액션 실행
      await createChatRoomAction(page, roomName);

      // 검증
      await expect(page).toHaveURL(new RegExp(`${BASE_URL}/chat/\\w+`));
      await expect(page.getByTestId('chat-message-input')).toBeVisible();
      await expect(page.getByTestId('chat-messages-container')).toBeVisible();
    });

    test('채팅방 목록에서 첫 번째 채팅방 입장', async ({ page }) => {
      // 액션 실행
      await joinFirstChatRoomAction(page);

      // 검증
      await expect(page).toHaveURL(new RegExp(`${BASE_URL}/chat/\\w+`));
      await expect(page.getByTestId('chat-message-input')).toBeVisible();
      await expect(page.getByTestId('chat-messages-container')).toBeVisible();
    });
  });

  test.describe('메시지 전송', () => {
    test.beforeEach(async ({ page }) => {
      await joinRandomChatRoomAction(page);
    });

    test('금칙어 포함 메시지 전송 시 에러 토스트 표시', async ({ page }) => {
      const forbiddenMessage = getRandomForbiddenWord();

      // 금칙어 메시지 전송 시도
      await sendMessageAction(page, forbiddenMessage);

      // 에러 토스트 표시 확인
      // toast-error 는 연결 끊김·업로드 실패 등 15곳이 공유하는 범용 testid 라
      // 가시성만 보면 서버 장애로 전송이 실패해도 금칙어 차단으로 오인한다.
      const errorToast = page.getByTestId('toast-error');
      await expect(errorToast).toBeVisible({ timeout: 5000 });
      await expect(errorToast).toContainText('금칙어');

      // 메시지가 채팅창에 전송되지 않았는지 확인
      const sentMessage = page.getByTestId('message-content').filter({ hasText: forbiddenMessage });
      await expect(sentMessage).not.toBeVisible();
    });

    test('일반 텍스트 메시지 전송', async ({ page }) => {
      const message = `안녕하세요! 테스트 메시지입니다. ${generateRandomMessage()}`;

      // 액션 실행
      await sendMessageAction(page, message);

      // 검증
      const messageElement = page.getByTestId('message-content').filter({ hasText: message });
      await expect(messageElement).toBeVisible();
    });

    test('이미지 파일 업로드 및 검증', async ({ page }) => {
      const filePath = path.resolve(__dirname, '../fixtures/images/profile.jpg');
      const message = `이미지 파일 업로드 테스트 ${generateRandomMessage()}`;

      // 1. 업로드 API 응답 감청
      const uploadPromise = page.waitForResponse(
        response => response.url().includes('/api/files/upload') && response.status() === 200,
        { timeout: 15000 }
      );

      // 2. 파일 업로드 액션
      await uploadFileAction(page, filePath, message);

      // 3. 업로드 완료 대기
      const uploadResponse = await uploadPromise;
      const responseData = await uploadResponse.json();

      // 4. 응답 데이터 검증
      expect(responseData).toHaveProperty('file');
      expect(responseData.file).toHaveProperty('mimetype');
      expect(responseData.file.mimetype).toContain('image/');

      // 5. FileMessage가 DOM에 렌더링되는지 확인 (메시지 내용으로 찾기)
      const fileMessageContainer = page.getByTestId('file-message-container').filter({ hasText: message });
      await expect(fileMessageContainer).toBeVisible({ timeout: 10000 });

      // 6. 이미지 요소가 존재하는지 확인
      const imageElement = fileMessageContainer.getByTestId('file-image-preview');
      await expect(imageElement).toBeAttached();

      // 7. 이미지 src 속성 확인
      const imageSrc = await imageElement.getAttribute('src');
      expect(imageSrc).toBeTruthy();

      // 8. 파일명이 표시되는지 확인
      await expect(fileMessageContainer.locator('text=/profile\\.jpg/i')).toBeVisible();

      // 9. 파일 크기가 표시되는지 확인 (KB, MB 등)
      await expect(fileMessageContainer.locator('text=/\\d+(\\.\\d+)?\\s*(KB|MB|GB)/i')).toBeVisible();

      // 10. FileActions 버튼들이 렌더링되는지 확인
      await expect(fileMessageContainer.getByTestId('file-download-button')).toBeVisible();
      await expect(fileMessageContainer.getByTestId('file-view-button')).toBeVisible();
    });

    test('PDF 파일 업로드 및 검증', async ({ page }) => {
      const filePath = path.resolve(__dirname, '../fixtures/pdf/sample.pdf');
      const message = `PDF 파일 업로드 테스트 ${generateRandomMessage()}`;

      // 1. 업로드 API 응답 감청
      const uploadPromise = page.waitForResponse(
        response => response.url().includes('/api/files/upload') && response.status() === 200,
        { timeout: 15000 }
      );

      // 2. 파일 업로드 액션
      await uploadFileAction(page, filePath, message);

      // 3. 업로드 완료 대기
      const uploadResponse = await uploadPromise;
      const responseData = await uploadResponse.json();

      // 4. 응답 데이터 검증 - PDF mimetype
      expect(responseData).toHaveProperty('file');
      expect(responseData.file).toHaveProperty('mimetype');
      expect(responseData.file.mimetype).toContain('pdf');

      // 5. FileMessage가 DOM에 렌더링되는지 확인 (메시지 내용으로 찾기)
      const fileMessageContainer = page.getByTestId('file-message-container').filter({ hasText: message });
      await expect(fileMessageContainer).toBeVisible({ timeout: 10000 });

      // 6. 파일명이 표시되는지 확인
      await expect(fileMessageContainer.locator('text=/sample\\.pdf/i')).toBeVisible();

      // 7. 파일 크기가 표시되는지 확인
      await expect(fileMessageContainer.locator('text=/\\d+(\\.\\d+)?\\s*(B|KB|MB|GB)/i')).toBeVisible();

      // 8. FileActions 버튼들이 렌더링되는지 확인
      await expect(fileMessageContainer.getByTestId('file-download-button')).toBeVisible();
      await expect(fileMessageContainer.getByTestId('file-view-button')).toBeVisible();
    });

    test('여러 메시지 연속 전송', async ({ page }) => {
      const messages = await sendMultipleMessagesAction(page, 5);

      // 모든 메시지가 표시되는지 검증
      await Promise.all(
        messages.map((message) =>
          expect(
            page.getByTestId('message-content').filter({ hasText: message })
          ).toBeVisible()
        )
      );
    });
  });

  test.describe('실시간 채팅', () => {
    test('다자간(5인) 실시간 메시지 송수신', async ({ browser }) => {
      // 첫 번째 사용자: 채팅방 생성
      const hostPage = await browser.newPage();
      await loginAction(hostPage, testUsers[0]);
      const roomName = `다자간_채팅방_${generateUniqueId()}`;
      await createChatRoomAction(hostPage, roomName);

      // 채팅방 UI 로드 검증
      const chatRoomUrl = hostPage.url();
      await expect(hostPage.getByTestId('chat-messages-container')).toBeVisible();
      await expect(hostPage.getByTestId('chat-message-input')).toBeVisible();

      // 나머지 사용자들 순차적으로 입장 (소켓 연결 안정화)
      const guestPages = [];
      for (const user of testUsers.slice(1)) {
        const page = await browser.newPage();
        await loginAction(page, user);
        await page.goto(chatRoomUrl);
        await expect(page.getByTestId('chat-messages-container')).toBeVisible();
        await expect(page.getByTestId('chat-message-input')).toBeVisible();
        await page.waitForTimeout(500);
        guestPages.push(page);
      }

      const allPages = [hostPage, ...guestPages];

      // 소켓 연결 안정화 대기
      await hostPage.waitForTimeout(1000);

      // 각 사용자 순차적으로 메시지 전송 및 검증
      for (const [index, senderPage] of allPages.entries()) {
        const message = `User${index + 1} 메시지 ${generateRandomMessage()}`;
        await sendMessageAction(senderPage, message);
        await senderPage.waitForTimeout(300);

        // 모든 사용자가 메시지를 수신했는지 검증
        await Promise.all(
          allPages.map((page) =>
            expect(
              page.getByTestId('message-content').filter({ hasText: message })
            ).toBeVisible({ timeout: 15000 })
          )
        );
      }

      // 정리
      await Promise.all(allPages.map((page) => page.close()));
    });
  });

  test.describe('메시지 읽음 상태', () => {
    test('2인 채팅에서 상대방이 메시지 확인 시 모두 읽음 상태로 변경', async ({ browser }) => {
      // 1. user1: 채팅방 생성
      const user1Page = await browser.newPage();
      await loginAction(user1Page, testUsers[0]);

      const roomName = `읽음테스트_${generateUniqueId()}`;
      await createChatRoomAction(user1Page, roomName);
      const chatRoomUrl = user1Page.url();

      // 2. user2: 채팅방 입장
      const user2Page = await browser.newPage();
      await loginAction(user2Page, testUsers[1]);
      await user2Page.goto(chatRoomUrl);
      await expect(user2Page.getByTestId('chat-messages-container')).toBeVisible();

      // 소켓 연결 안정화 대기
      await user1Page.waitForTimeout(1000);

      // 3. user1: 메시지 전송
      const message = `읽음 테스트 ${generateRandomMessage()}`;
      await sendMessageAction(user1Page, message);

      // 4. user2: 메시지 수신 확인 (화면에 보이면 자동 읽음 처리)
      const user2MessageContainer = user2Page.getByTestId('message-container').filter({ hasText: message });
      await expect(user2MessageContainer).toBeVisible();

      // 읽음 처리 및 소켓 통신 대기
      await user2Page.waitForTimeout(2000);

      // 5. user1 화면: "모두 읽음" 확인
      const user1MessageContainer = user1Page.getByTestId('message-container').filter({ hasText: message });
      await expect(user1MessageContainer.getByTestId('read-status-all-read')).toBeVisible({ timeout: 5000 });

      await user1Page.close();
      await user2Page.close();
    });
  });

  test.describe('채팅 히스토리', () => {
    test('메시지 전송 후 새로고침하여 히스토리 끝 확인', async ({ page }) => {
      // 신규 채팅방 생성 및 입장
      const roomName = `히스토리_테스트_채팅방_${Math.random().toString(36).substring(2, 8)}`;
      await createChatRoomAction(page, roomName);

      // 여러 메시지 전송
      await sendMultipleMessagesAction(page, 61);

      // 현재 URL 저장
      const currentUrl = page.url();

      // 페이지 새로고침
      await page.waitForTimeout(1000);
      await page.reload();
      await page.waitForURL(currentUrl);

      // 채팅 컨테이너가 로드될 때까지 대기
      await expect(page.getByTestId('chat-messages-container')).toBeVisible();

      // 히스토리 끝이 보일 때까지 스크롤 반복
      const historyEndElement = page.getByTestId('message-history-end');
      while (!(await historyEndElement.isVisible())) {
        await scrollChatToTopAction(page);
      }

      // 최종 검증
      await expect(historyEndElement).toBeVisible();
    });
  });
});

/**
 * 첨부 이미지의 로드와 다운로드만 보는 그룹.
 *
 * 위 '채팅 E2E 테스트'의 5인 준비 훅에 얹지 않는다 — 이 검증에 필요한 계정은 하나뿐이고,
 * 방도 직접 만들어 참가자 권한을 확정한다(첨부 조회는 방 참가자만 통과한다).
 */
test.describe('채팅 첨부 이미지', () => {
  let testUser;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    testUser = {
      email: `filetest_${Date.now()}@example.com`,
      password: 'Password123!',
      passwordConfirm: 'Password123!',
      name: 'File Test User',
    };

    await registerAction(page, testUser);

    await page.close();
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAction(page, testUser);
    await createChatRoomAction(page, `첨부_이미지_${generateUniqueId()}`);
  });

  test('첨부 이미지가 실제로 렌더링되고 원본 그대로 다운로드된다', async ({ page }) => {
    const message = `이미지 로드/다운로드 테스트 ${generateRandomMessage()}`;

    const uploadPromise = page.waitForResponse(
      (response) => response.url().includes('/api/files/upload') && response.status() === 200,
      { timeout: 15000 }
    );

    await uploadFileAction(page, IMAGE_FIXTURE_PATH, message);

    const { file } = await (await uploadPromise).json();

    const fileMessageContainer = page
      .getByTestId('file-message-container')
      .filter({ hasText: message });
    await expect(fileMessageContainer).toBeVisible({ timeout: 10000 });

    // 1. 미리보기가 placeholder가 아닌 실제 첨부 URL을 가리키고, 디코딩까지 끝났는지
    const imageElement = fileMessageContainer.getByTestId('file-image-preview');
    await expect(imageElement).toHaveAttribute(
      'src',
      new RegExp(`/api/files/view/${file.filename}`),
      { timeout: 10000 }
    );
    await expect
      .poll(async () => (await readImageState(imageElement)).naturalWidth, { timeout: 15000 })
      .toBeGreaterThan(0);

    // 2. 미리보기 URL을 직접 조회해 원본 크기의 이미지가 내려오는지
    const { src } = await readImageState(imageElement);
    const viewResponse = await page.request.get(src);
    expect(viewResponse.status()).toBe(200);
    expect(viewResponse.headers()['content-type']).toContain('image/');
    expect((await viewResponse.body()).length).toBe(IMAGE_FIXTURE_SIZE);

    // 3. 다운로드 버튼으로 받은 파일이 원본과 바이트 단위로 같은지
    const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
    await fileMessageContainer.getByTestId('file-download-button').click();
    const download = await downloadPromise;

    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toBe('profile.jpg');

    const downloadedPath = await download.path();
    expect(fs.statSync(downloadedPath).size).toBe(IMAGE_FIXTURE_SIZE);
    expect(sha256OfFile(downloadedPath)).toBe(sha256OfFile(IMAGE_FIXTURE_PATH));
  });
});
