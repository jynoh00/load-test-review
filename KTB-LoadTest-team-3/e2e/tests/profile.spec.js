const path = require('path');
const { test, expect } = require('@playwright/test');
const { loginAction, registerAction } = require('../actions/auth.actions');
const {
  goToProfileAction,
  changeProfileImageAction,
  deleteProfileImageAction,
  updateProfileAction,
} = require('../actions/profile.actions');

const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PROFILE_IMAGE_PATH = path.resolve(__dirname, '../fixtures/images/profile.jpg');
const PROFILE_IMAGE_SIZE = fs.statSync(PROFILE_IMAGE_PATH).size;

/**
 * img 요소가 실제로 디코딩까지 끝냈는지 읽는다.
 * 아바타는 로드에 실패하면 이니셜 fallback으로 대체되므로, 요소가 보이는 것만으로는
 * 이미지가 떴다고 말할 수 없다. naturalWidth가 유일한 증거다.
 */
const readImageState = (locator) =>
  locator.evaluate((img) => ({
    src: img.currentSrc || img.src,
    complete: img.complete,
    naturalWidth: img.naturalWidth,
  }));

test.describe('프로필 smoke', () => {
  test('@smoke 비로그인 사용자를 로그인 화면으로 보낸다', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`);

    await expect(page).toHaveURL(new RegExp(`^${BASE_URL}/`));
    await expect(page.getByTestId('login-email-input')).toBeVisible({ timeout: 6000 });
  });
});

test.describe.serial('프로필 E2E 테스트', () => {
  let testUser;

  test.beforeAll(async ({ browser }) => {
    // 테스트용 계정 생성
    const context = await browser.newContext();
    const page = await context.newPage();

    testUser = {
      email: `profiletest_${Date.now()}@example.com`,
      password: 'Password123!',
      passwordConfirm: 'Password123!',
      name: 'Profile Test User',
    };

    await registerAction(page, testUser);

    await page.waitForTimeout(1000);
    await page.close();
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    // 로그인 상태로 시작
    await loginAction(page, testUser);
    await expect(page).toHaveURL(`${BASE_URL}/chat`);
  });

  test.describe('프로필 페이지 접근', () => {
    test('프로필 페이지 로드', async ({ page }) => {
      // 액션 실행
      await goToProfileAction(page);

      // 검증
      await expect(page).toHaveURL(`${BASE_URL}/profile`);
      await expect(page.getByTestId('profile-name-input')).toBeVisible();
      await expect(page.getByTestId('profile-save-button')).toBeVisible();
    });
  });

  test.describe('프로필 정보 수정', () => {
    test('이름 변경', async ({ page }) => {
      const newName = `테스트_${Math.random().toString(36).substring(2, 8)}`;

      // 액션 실행
      await updateProfileAction(page, { name: newName });

      // 검증
      await expect(page.getByTestId('profile-success-message')).toBeVisible();
      await expect(page.getByTestId('profile-name-input')).toHaveValue(newName);
    });
  });

  test.describe('프로필 이미지 관리', () => {
    test('프로필 이미지 변경', async ({ page }) => {
      // 액션 실행
      await changeProfileImageAction(page, PROFILE_IMAGE_PATH);

      // 검증 - Toast 성공 메시지 표시
      await expect(page.getByTestId('toast-success')).toBeVisible();

      // 검증 - 아바타가 보이고, 업로드 및 삭제 버튼이 보여야 함
      await expect(page.getByTestId('profile-image-avatar')).toBeVisible();
      await expect(page.getByTestId('profile-image-upload-button')).toBeVisible();
      await expect(page.getByTestId('profile-image-delete-button')).toBeVisible();
    });

    test('저장된 프로필 이미지가 새로고침 후에도 로드된다', async ({ page }) => {
      const uploadResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/users/profile-image') &&
          response.request().method() === 'POST',
        { timeout: 20000 }
      );

      await changeProfileImageAction(page, PROFILE_IMAGE_PATH);

      const uploadResponse = await uploadResponsePromise;
      expect(uploadResponse.status()).toBe(200);

      const { imageUrl } = await uploadResponse.json();
      expect(imageUrl).toMatch(/^\/api\/files\/profiles\//);

      await expect(page.getByTestId('toast-success')).toBeVisible({ timeout: 15000 });

      // 업로드 직후 화면은 로컬 blob 미리보기일 수 있으므로, 새로고침해서
      // 서버에 저장된 이미지가 실제로 내려오는지 확인한다.
      await page.reload();

      const avatarImage = page.getByTestId('profile-image-avatar').locator('img');
      await expect(avatarImage).toHaveAttribute('src', new RegExp(`${imageUrl}$`), { timeout: 15000 });

      await expect
        .poll(async () => (await readImageState(avatarImage)).naturalWidth, { timeout: 15000 })
        .toBeGreaterThan(0);

      const { src, complete } = await readImageState(avatarImage);
      expect(complete).toBe(true);

      const imageResponse = await page.request.get(src);
      expect(imageResponse.status()).toBe(200);
      expect(imageResponse.headers()['content-type']).toContain('image/');
      expect((await imageResponse.body()).length).toBe(PROFILE_IMAGE_SIZE);
    });

    test('프로필 이미지 삭제', async ({ page }) => {
      // 액션 실행
      await deleteProfileImageAction(page);

      // 검증 - 삭제 버튼이 사라져야 함
      await expect(page.getByTestId('profile-image-delete-button')).not.toBeVisible();
    });
  });
});
