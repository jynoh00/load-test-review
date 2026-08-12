const { test, expect } = require('@playwright/test');
const { registerAction, loginAction } = require('../actions/auth.actions');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * 서버 과부하 상황에서 프론트엔드가 어느 시점에 "타임아웃"으로 판정하는지 계측한다.
 *
 * 실제 서버에 부하를 주는 대신 브라우저 레벨에서 응답을 지연·드롭시켜
 * 각 타임아웃 경로를 개별로 재현한다.
 *   - HTTP: page.route 로 /api/* 응답을 붙잡거나 늦춘다
 *   - WebSocket: page.routeWebSocket 으로 socket.io 프레임을 선택적으로 드롭·변조한다
 *
 * 문구 확인뿐 아니라 타임아웃까지 걸린 실제 시간을 기록해 설계값과 체감값을 비교한다.
 */

const SOCKET_IO_PATTERN = /socket\.io/;

/**
 * 실패가 화면에 드러나는 표면.
 * useChatRoomLifecycle 이 setupRoom 실패를 잡아 하나의 문구로 덮어쓰기 때문에
 * 원인별 문구 대신 "실패가 드러난 시점"을 잡아 계측한다.
 */
const ERROR_SURFACE = /실패했습니다|초과되었습니다|오류가 발생했습니다|연결에 문제가 생겼어요|연결할 수 없습니다/;

const measurements = [];

const measure = async (label, expected, fn) => {
  const startedAt = Date.now();
  await fn();
  const elapsedMs = Date.now() - startedAt;
  measurements.push({ label, expected, elapsedMs });
  console.log(`⏱  ${label}: ${(elapsedMs / 1000).toFixed(1)}s (설계값 ${expected})`);
  return elapsedMs;
};

/** socket.io v4 EVENT 프레임(42[...])에서 이벤트 이름을 읽는다. */
const eventNameOf = (payload) => {
  if (typeof payload !== 'string' || !payload.startsWith('42')) {
    return null;
  }

  try {
    const [name] = JSON.parse(payload.slice(2));
    return name;
  } catch {
    return null;
  }
};

/** 실패 표면이 뜰 때까지 기다리고, 사용자가 실제로 읽는 문구를 남긴다. */
const waitForErrorSurface = async (page, timeout) => {
  const surface = page.getByText(ERROR_SURFACE).first();
  await expect(surface).toBeVisible({ timeout });
  console.log(`  · 화면 문구: "${(await surface.innerText()).trim()}"`);
};

const withoutMessages = (payload) => {
  const [name, body] = JSON.parse(payload.slice(2));
  const { messages, ...rest } = body;
  return `42${JSON.stringify([name, rest])}`;
};

test.describe.serial('서버 과부하 시 프론트 타임아웃', () => {
  let storageState;
  let roomId;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const user = {
      email: `timeout_${Date.now()}@example.com`,
      password: 'Password123!',
      passwordConfirm: 'Password123!',
      name: 'Timeout Probe',
    };

    await registerAction(page, user);
    await loginAction(page, user);

    // 이후 테스트가 방에 직접 진입할 수 있도록 한 번 정상 입장해 참여자로 등록한다.
    await page.getByTestId('join-chat-room-button').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.getByTestId('join-chat-room-button').first().click();
    await page.waitForURL(new RegExp(`${BASE_URL}/chat/[a-f0-9]{24}`), { timeout: 30000 });

    roomId = page.url().split('/').pop();
    storageState = await context.storageState();

    await context.close();
  });

  test.afterAll(() => {
    console.log('\n===== 타임아웃 계측 요약 =====');
    for (const { label, expected, elapsedMs } of measurements) {
      console.log(`${(elapsedMs / 1000).toFixed(1).padStart(6)}s  (설계값 ${expected})  ${label}`);
    }
  });

  const openSession = async (browser) => {
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    return { context, page };
  };

  test('S1. health 무응답 → 방 목록이 실패를 판정하기까지', async ({ browser }) => {
    test.setTimeout(300000);
    const { context, page } = await openSession(browser);

    let healthAttempts = 0;
    // 응답을 주지 않고 붙잡아 둔다 → health timeout 3s 가 발동한다.
    await page.route('**/api/health', async () => {
      healthAttempts += 1;
      console.log(`  · /api/health 요청 #${healthAttempts} 붙잡음`);
    });

    await page.goto(`${BASE_URL}/chat`);

    await measure(
      'S1 health 무응답 → 방 목록이 실패를 알리기까지',
      '3s x 3회(1층) x 2회(2층) + 백오프 ≈ 27s',
      () => waitForErrorSurface(page, 280000)
    );

    console.log(`  · /api/health 총 요청 수: ${healthAttempts}`);
    await context.close();
  });

  test('S2. health 2.5s 지연 → 타임아웃 경계 바로 아래', async ({ browser }) => {
    test.setTimeout(120000);
    const { context, page } = await openSession(browser);

    await page.route('**/api/health', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });

    await page.goto(`${BASE_URL}/chat`);

    await measure(
      'S2 health 2.5s 지연 → 방 목록 렌더까지',
      '3s timeout 미만이라 성공, 사용자는 그만큼 대기',
      async () => {
        await expect(page.getByTestId('join-chat-room-button').first()).toBeVisible({ timeout: 60000 });
      }
    );

    await context.close();
  });

  test('S3. WS handshake 무응답 → 소켓 연결 타임아웃', async ({ browser }) => {
    test.setTimeout(180000);
    const { context, page } = await openSession(browser);

    // 서버로 연결하지 않고 아무 프레임도 보내지 않는다 → socket.io OPEN 패킷이 오지 않는다.
    await page.routeWebSocket(SOCKET_IO_PATTERN, () => {
      console.log('  · WS 연결을 가로채고 응답하지 않음');
    });

    await page.goto(`${BASE_URL}/chat/${roomId}`);

    await measure(
      'S3 WS handshake 무응답 → 실패 노출',
      '자체 connectionTimeout 30s',
      () => waitForErrorSurface(page, 150000)
    );

    // /_error 이스케이프를 걷어냈으므로 방 URL 에 머문 채 배너로 알린다.
    expect(page.url()).not.toMatch(/_error/);
    console.log(`  · 최종 URL: ${page.url()}`);
    await context.close();
  });

  test('S4. joinRoom 응답 드롭 → 채팅방 입장 타임아웃', async ({ browser }) => {
    test.setTimeout(120000);
    const { context, page } = await openSession(browser);

    await page.routeWebSocket(SOCKET_IO_PATTERN, (ws) => {
      const server = ws.connectToServer();

      server.onMessage((payload) => {
        if (eventNameOf(payload) === 'joinRoomSuccess') {
          console.log('  · joinRoomSuccess 프레임 드롭');
          return;
        }
        ws.send(payload);
      });
    });

    await page.goto(`${BASE_URL}/chat/${roomId}`);

    await measure(
      'S4 joinRoom 응답 드롭 → 입장 실패 노출',
      'joinRoomAndWait 10s, 재시도 없음',
      () => waitForErrorSurface(page, 90000)
    );

    await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();

    // socketClient 가 만든 원인별 문구는 useChatRoomLifecycle 에서 덮어써져 도달하지 못한다.
    await expect(page.getByText('채팅방 입장 시간이 초과되었습니다')).toHaveCount(0);
    await context.close();
  });

  test('S5. 이전 메시지 로딩 드롭 → 재시도 누적', async ({ browser }) => {
    test.setTimeout(180000);
    const { context, page } = await openSession(browser);

    let droppedLoads = 0;

    await page.routeWebSocket(SOCKET_IO_PATTERN, (ws) => {
      const server = ws.connectToServer();

      server.onMessage((payload) => {
        const eventName = eventNameOf(payload);

        // joinRoomSuccess 가 messages 를 실어오면 초기 로딩 경로를 타지 않는다.
        // messages 를 떼어내 fetchPreviousMessages 경로로 유도한다.
        if (eventName === 'joinRoomSuccess') {
          console.log('  · joinRoomSuccess 에서 messages 제거');
          ws.send(withoutMessages(payload));
          return;
        }

        if (eventName === 'previousMessagesLoaded') {
          droppedLoads += 1;
          console.log(`  · previousMessagesLoaded 프레임 드롭 #${droppedLoads}`);
          return;
        }

        ws.send(payload);
      });
    });

    await page.goto(`${BASE_URL}/chat/${roomId}`);

    await measure(
      'S5 previousMessagesLoaded 드롭 → 메시지 로딩 실패 노출',
      '5s x 4회 시도 + 2s x 3회 대기 ≈ 26s',
      () => waitForErrorSurface(page, 150000)
    );

    console.log(`  · 드롭한 previousMessagesLoaded 수: ${droppedLoads}`);
    await context.close();
  });

  test('S6. 입장 후 연결 끊김 → 배지로만 알린다', async ({ browser }) => {
    test.setTimeout(120000);
    const { context, page } = await openSession(browser);

    let joined = false;

    await page.routeWebSocket(SOCKET_IO_PATTERN, (ws) => {
      const server = ws.connectToServer();

      server.onMessage((payload) => {
        ws.send(payload);

        if (!joined && eventNameOf(payload) === 'joinRoomSuccess') {
          joined = true;
          console.log('  · 입장 성공 확인, 3s 뒤 소켓을 끊는다');
          setTimeout(() => ws.close({ code: 1006, reason: 'overload' }), 3000);
        }
      });
    });

    await page.goto(`${BASE_URL}/chat/${roomId}`);

    await measure(
      'S6 강제 끊김 → 재접속 배지 노출',
      '즉시 disconnect 반영',
      async () => {
        await expect(page.getByText('재접속 중')).toBeVisible({ timeout: 90000 });
      }
    );

    // 복구 가능한 상태이므로 메시지 영역을 오류로 덮지 않는다.
    await expect(page.getByTestId('chat-message-input')).toBeVisible();

    await context.close();
  });
});
