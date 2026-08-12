// 오프라인 계약 테스트. 서버 기동/네트워크 없이 정적 파일(asyncapi, frontend 소스,
// 부하기 소스)만 읽어 소켓 이벤트명이 [asyncapi]와 어긋나지 않는지 강제한다.
// 검증 방향은 항상 "부하기/앱이 쓰는 이벤트 ⊆ asyncapi/계약" 부분집합이며 동치가 아니다
// — asyncapi에는 부하기가 쓰지 않는 채널(AI 스트리밍 등)도 있다.
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const { CLIENT_EMIT, SERVER_EMIT } = require('../socket-contract');

const ASYNCAPI_PATH = path.join(
  __dirname,
  '../../apps/backend/src/main/resources/static/api/docs/socketio/asyncapi.yaml',
);
const FRONTEND_SOCKET_CLIENT_PATH = path.join(
  __dirname,
  '../../apps/frontend/lib/socket/socketClient.js',
);
const LOAD_TEST_PATH = path.join(__dirname, '../load-test.js');
const RAMP_UP_TEST_PATH = path.join(__dirname, '../ramp-up-test.js');

// Socket.IO 예약/표준 이벤트만 리터럴 허용. 도메인 이벤트는 socket-contract.js 상수 사용.
const ALLOWED_RESERVED_EVENTS = ['connect', 'disconnect', 'connect_error', 'reconnect', 'reconnecting'];

describe('contract-drift', () => {
  test('검사1: socket-contract.js의 모든 값(15개)이 asyncapi channels.*.address에 존재한다', () => {
    const doc = YAML.parse(fs.readFileSync(ASYNCAPI_PATH, 'utf8'));
    const addresses = new Set(Object.values(doc.channels).map((channel) => channel.address));
    const allContractValues = [...Object.values(CLIENT_EMIT), ...Object.values(SERVER_EMIT)];

    const missingFromAsyncapi = allContractValues.filter((value) => !addresses.has(value));

    expect(missingFromAsyncapi).toEqual([]);
  });

  test('검사2: frontend roomEventMap 키는 전부 SERVER_EMIT 값에 포함된다 (부분집합)', () => {
    const source = fs.readFileSync(FRONTEND_SOCKET_CLIENT_PATH, 'utf8');
    const mapBlock = source.match(/roomEventMap\s*=\s*\{([\s\S]*?)\n\};/);
    expect(mapBlock).not.toBeNull();

    const keyPattern = /^\s*(\w+):/gm;
    const roomEventMapKeys = [];
    let match;
    while ((match = keyPattern.exec(mapBlock[1])) !== null) {
      roomEventMapKeys.push(match[1]);
    }
    expect(roomEventMapKeys.length).toBeGreaterThan(0);

    const serverEmitValues = new Set(Object.values(SERVER_EMIT));
    const notInContract = roomEventMapKeys.filter((key) => !serverEmitValues.has(key));

    expect(notInContract).toEqual([]);
  });

  test('검사3: frontend의 sendDomainEvent/trySendOn 이벤트 리터럴은 전부 CLIENT_EMIT 값에 포함된다 (부분집합)', () => {
    const source = fs.readFileSync(FRONTEND_SOCKET_CLIENT_PATH, 'utf8');
    const eventLiteralPattern = /(?:sendDomainEvent\(\s*service,\s*socket,\s*|trySendOn\(\s*socket,\s*)'([^']+)'/g;

    const foundEvents = new Set();
    let match;
    while ((match = eventLiteralPattern.exec(source)) !== null) {
      foundEvents.add(match[1]);
    }
    expect(foundEvents.size).toBeGreaterThan(0);

    const clientEmitValues = new Set(Object.values(CLIENT_EMIT));
    const notInContract = [...foundEvents].filter((event) => !clientEmitValues.has(event));

    expect(notInContract).toEqual([]);
  });

  test('검사4 (리터럴 금지): 부하기 스크립트에 허용 목록 밖 이벤트명 리터럴이 없다', () => {
    const violations = [];

    for (const filePath of [LOAD_TEST_PATH, RAMP_UP_TEST_PATH]) {
      const source = fs.readFileSync(filePath, 'utf8');
      const emitOnPattern = /\.(emit|on|once)\(\s*'([^']+)'/g;

      let match;
      while ((match = emitOnPattern.exec(source)) !== null) {
        const [, method, eventName] = match;
        if (!ALLOWED_RESERVED_EVENTS.includes(eventName)) {
          violations.push(`${path.basename(filePath)}: .${method}('${eventName}')`);
        }
      }
    }

    // 위반이 있으면 목록을 실패 메시지에 그대로 노출한다 — 위반 수를 하드코딩하지 않는다.
    if (violations.length > 0) {
      throw new Error(
        `허용 목록 밖 이벤트명 리터럴 ${violations.length}건 발견:\n${violations.join('\n')}`,
      );
    }
  });
});
