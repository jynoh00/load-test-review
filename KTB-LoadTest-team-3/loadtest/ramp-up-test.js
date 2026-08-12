#!/usr/bin/env node

/**
 * KTB Chat Ramp-Up Load Test
 *
 * 📋 테스트 시나리오
 * ================================================================================
 *
 * 1️⃣ 테스트 목적
 *    - 점진적 사용자 증가 시 시스템 안정성 검증
 *    - Socket.IO 연결 및 메시지 처리 성능 측정
 *    - 실시간 채팅 환경의 부하 한계점 파악
 *    - 연결 해제 패턴 분석 (서버/클라이언트/타임아웃)
 *
 * 2️⃣ 테스트 단계
 *    Phase 1: Initialization (초기화)
 *      - Admin 사용자 생성 및 인증
 *      - 테스트 환경 설정 검증
 *
 *    Phase 2: Ramp-Up (사용자 증가)
 *      - 매 초마다 min-users-per-second ~ max-users-per-second 명의 사용자 추가
 *      - 각 배치마다 새로운 채팅방 생성
 *      - 모든 사용자가 Socket.IO 연결 수립
 *      - max-users 도달 시까지 반복
 *
 *    Phase 3: Sustaining (부하 유지)
 *      - 최대 사용자 수 도달 후 sustain-duration 동안 유지
 *      - 모든 사용자가 지속적으로 메시지 송수신
 *      - 메시지 간격: message-interval-min ~ message-interval-max (ms)
 *
 *    Phase 4: Completion (완료)
 *      - 모든 연결 정상 종료
 *      - 최종 메트릭 집계 및 출력
 *
 * 3️⃣ 사용자 시뮬레이션
 *    각 가상 사용자는 다음 동작을 순차적으로 수행:
 *      a) 회원가입 (POST /api/auth/register) 또는 로그인 (POST /api/auth/login)
 *      b) [REST API] 방 입장 (POST /api/rooms/:roomId/join)
 *      c) [REST API] 방 정보 확인 (GET /api/rooms/:roomId)
 *      d) Socket.IO 연결 (with JWT token & sessionId)
 *      e) [WebSocket] 채팅방 참여 (joinRoom event)
 *      f) [WebSocket] 이전 메시지 가져오기 (fetchPreviousMessages event → previousMessagesLoaded 수신)
 *      g) 랜덤 간격으로 메시지 전송 (chatMessage event → message 브로드캐스트 수신)
 *      h) 수신한 메시지를 읽음 처리 (markMessagesAsRead event → messagesRead 수신)
 *      i) 수신 메시지의 10%에 리액션 (messageReaction event → messageReactionUpdate 수신)
 *
 * 4️⃣ 백프레셔(Backpressure) 메커니즘
 *    - 연결 오류가 5초 내에 3회 이상 발생 시 자동 활성화
 *    - 활성화 시 3초간 신규 사용자 생성 중단
 *    - 최대 20회 백프레셔 허용, 초과 시 테스트 중단
 *    - 시스템 과부하 방지 및 안정적인 테스트 진행 보장
 *
 * 5️⃣ 수집 메트릭
 *    연결 메트릭:
 *      - Rooms Created: 생성된 채팅방 수
 *      - Users Created: 생성된 사용자 수
 *      - Active Users: 현재 활성 사용자 수
 *      - Connected: 성공적으로 연결된 소켓 수
 *      - Total Disconnected: 총 연결 해제 수
 *        └─ By Server: 서버에 의한 연결 해제
 *        └─ By Client: 클라이언트에 의한 연결 해제
 *        └─ Ping Timeout: Ping 타임아웃으로 인한 해제
 *        └─ Other: 기타 사유로 인한 해제
 *
 *    메시지 메트릭:
 *      - Messages Sent: 전송한 메시지 수
 *      - Messages Received: 수신한 메시지 수
 *      - Messages Read: 읽음 처리한 메시지 수
 *      - Read Acks Received: 읽음 확인 수신 수
 *      - Messages/sec: 초당 메시지 처리량
 *      - Reactions Sent: 전송한 리액션 수
 *      - Reaction Updates Recv: 리액션 갱신 수신 수 (방 브로드캐스트라 송신보다 큼)
 *      - Participants Updates: 참여자 목록 갱신 수신 수
 *      - Session Ended Recv: 세션 종료 통지 수신 수
 *
 *    성능 메트릭:
 *      - Avg Message Latency: 평균 메시지 지연시간
 *      - P95 Message Latency: 95 백분위 지연시간
 *      - P99 Message Latency: 99 백분위 지연시간
 *      - Avg Connection Time: 평균 연결 수립 시간
 *
 *    에러 메트릭:
 *      - Room Errors: 채팅방 관련 오류
 *      - Auth Errors: 인증 관련 오류
 *      - Connection Errors: 연결 관련 오류
 *      - Message Errors: 메시지 관련 오류
 *
 * 6️⃣ 실행 예시
 *    기본 실행:
 *      $ node ramp-up-test.js
 *
 *    커스텀 설정:
 *      $ node ramp-up-test.js \
 *          --max-users 1000 \
 *          --min-users-per-second 5 \
 *          --max-users-per-second 10 \
 *          --sustain-duration 300 \
 *          --message-interval-min 1000 \
 *          --message-interval-max 5000 \
 *          --api-url http://api.example.com \
 *          --socket-url http://socket.example.com
 *
 * 7️⃣ 테스트 결과 활용
 *    - 시스템 용량 계획 (Capacity Planning)
 *    - 병목 지점 식별 (Bottleneck Analysis)
 *    - 인프라 스케일링 기준 설정
 *    - 연결 안정성 개선 방향 도출
 *    - SLA 기준 설정 (응답 시간, 처리량)
 *
 * ================================================================================
 */

const io = require('socket.io-client');
const axios = require('axios');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
const Table = require('cli-table3');
const { v4: uuidv4 } = require('uuid');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { createRing, addSample, addError, snapshot } = require('./breakpoint/windowed-metrics');
const { createDetector, calibrate, evaluate } = require('./breakpoint/breakpoint-detector');
const { CLIENT_EMIT, SERVER_EMIT } = require('./socket-contract');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('max-users', {
    alias: 'u',
    description: 'Maximum number of concurrent users',
    type: 'number',
    default: 500
  })
  .option('min-users-per-second', {
    description: 'Minimum users to add per second',
    type: 'number',
    default: 2
  })
  .option('max-users-per-second', {
    description: 'Maximum users to add per second',
    type: 'number',
    default: 5
  })
  .option('sustain-duration', {
    alias: 's',
    description: 'Duration to sustain max load in seconds',
    type: 'number',
    default: 60
  })
  .option('message-interval-min', {
    description: 'Minimum interval between messages in milliseconds',
    type: 'number',
    default: 500
  })
  .option('message-interval-max', {
    description: 'Maximum interval between messages in milliseconds',
    type: 'number',
    default: 3000
  })
  .option('api-url', {
    description: 'Backend REST API URL',
    type: 'string',
    default: 'http://localhost:5001'
  })
  .option('socket-url', {
    description: 'Socket.IO server URL',
    type: 'string',
    default: 'http://localhost:5002'
  })
  .option('room-id', {
    description: 'Room ID to send messages to (auto-create if not specified)',
    type: 'string',
    default: null
  })
  .help()
  .alias('help', 'h')
  .argv;

class RampUpLoadTester {
  constructor(config) {
    this.config = config;
    this.metrics = {
      usersCreated: 0,
      roomsCreated: 0,
      roomJoinsREST: 0,
      roomInfoFetches: 0,
      connected: 0,
      disconnected: 0,
      disconnectedByServer: 0,
      disconnectedByClient: 0,
      disconnectedByPingTimeout: 0,
      disconnectedOther: 0,
      messagesSent: 0,
      messagesReceived: 0,
      previousMessagesFetched: 0,
      messagesRead: 0,
      readAcksReceived: 0,
      reactionsSent: 0,
      reactionUpdatesReceived: 0,
      participantsUpdatesReceived: 0,
      sessionEndedReceived: 0,
      profileFetches: 0,
      profileUpdatesAttempted: 0,
      profileUpdatesSucceeded: 0,
      profileUpdatesFailed: 0,
      filesUploaded: 0,
      fileUploadsFailed: 0,
      errorsAuth: 0,
      errorsConnection: 0,
      errorsMessage: 0,
      errorsRoom: 0,
      latencies: [],  // deprecated: 대시보드 지연 표시는 socketRing 기반으로 대체됨
      connectionTimes: [],
      socketRing: createRing(5000),   // 소켓 echo RTT 슬라이딩 윈도우 (정상상태 RTT)
      restRing: createRing(5000),     // REST 응답시간 슬라이딩 윈도우 (join/roominfo)
      onboardingCohorts: [],          // { arrivedAt, activeUsersAtArrival, stages }
      pingTimeoutPrev: 0,             // 윈도우 증분 계산용 이전 누적값
      serverDisconnectPrev: 0,
      startTime: Date.now(),
      rampUpStartTime: null,
      maxUsersReachedTime: null,
      currentPhase: 'initializing'  // initializing, ramping-up, sustaining, completed
    };
    this.sockets = [];
    this.metricsInterval = null;
    this.logBuffer = [];
    this.maxLogLines = 10;
    this.userSpawnInterval = null;
    this.activeUsers = 0;
    this.sustainTimer = null;
    this.adminAuth = null;
    this.roomsList = [];  // Track all created rooms
    this.backpressureActive = false;
    this.recentConnectionErrors = [];
    this.connectionErrorWindow = 5000; // 5 seconds window
    this.connectionErrorThreshold = 3; // 3 errors in 5 seconds triggers backpressure
    this.backpressureDelay = 3000; // 3 seconds delay when backpressure is active
    this.backpressureCount = 0; // Track how many times backpressure has been activated
    this.maxBackpressureCount = 20; // Maximum allowed backpressure activations

    // ── 임계점 자동 판정 (breakpoint detection) ──────────────────────────────
    this.detector = createDetector({});
    this.nodeId = process.env.BP_NODE_ID || 'local';  // 다중 노드(EC2) 확장 대비
    this.windowFlushInterval = null;
    this.runOutputDir = null;      // run()에서 BP_OUTPUT_DIR 또는 기본값으로 설정
    this.timelinePath = null;
    this.breakingPointPath = null;
    this._breachRecorded = false;
    this._shuttingDown = false;
  }

  log(level, message, ...args) {
    const timestamp = new Date().toISOString().substring(11, 19);
    const formattedMessage = `[${timestamp}] ${message} ${args.join(' ')}`;

    this.logBuffer.push({ level, message: formattedMessage });
    if (this.logBuffer.length > this.maxLogLines) {
      this.logBuffer.shift();
    }
  }

  async createTestUser(userId = null) {
    try {
      const uniqueId = userId || uuidv4().substring(0, 8);
      const email = `loadtest-rampup-${uniqueId}@test.com`;
      const password = 'Test1234!';
      const name = `RampUp User ${uniqueId}`;

      let authRes;
      try {
        authRes = await axios.post(
          `${this.config.apiUrl}/api/auth/login`,
          { email, password },
          { timeout: 5000 }
        );
      } catch (loginError) {
        if (loginError.response?.status === 401 || loginError.response?.status === 404) {
          this.log('info', `Registering new user: ${email}`);
          await axios.post(
            `${this.config.apiUrl}/api/auth/register`,
            { email, password, name },
            { timeout: 5000 }
          );
          authRes = await axios.post(
            `${this.config.apiUrl}/api/auth/login`,
            { email, password },
            { timeout: 5000 }
          );
        } else {
          throw loginError;
        }
      }

      this.metrics.usersCreated++;
      return authRes.data;

    } catch (error) {
      this.metrics.errorsAuth++;
      this.log('error', `Failed to create/login user ${userId || 'unknown'}:`, error.message);
      return null;
    }
  }

  async createAdminUser() {
    try {
      this.log('info', 'Creating admin user for room management...');
      const adminAuth = await this.createTestUser('admin-room-creator' + uuidv4().substring(0, 8));
      if (!adminAuth) {
        throw new Error('Failed to create admin user for room creation');
      }
      this.log('success', 'Admin user created successfully');
      return adminAuth;
    } catch (error) {
      this.log('error', 'Failed to create admin user:', error.message);
      throw error;
    }
  }

  async fetchRoomsList() {
    try {
      if (!this.adminAuth) {
        throw new Error('Admin auth not initialized');
      }

      const response = await axios.get(
        `${this.config.apiUrl}/api/rooms`,
        {
          headers: {
            'Authorization': `Bearer ${this.adminAuth.token}`
          },
          params: {
            page: 0,
            pageSize: 10
          },
          timeout: 5000
        }
      );

      const totalRooms = response.data.metadata?.total || 0;
      this.log('info', `Fetched rooms list: ${totalRooms} total rooms in system`);
      return response.data;

    } catch (error) {
      this.log('warn', `Failed to fetch rooms list:`, error.message);
      return null;
    }
  }

  async createNewRoom(roomNumber) {
    try {
      if (!this.adminAuth) {
        throw new Error('Admin auth not initialized');
      }

      // Fetch room list before creating new room
      await this.fetchRoomsList();

      const response = await axios.post(
        `${this.config.apiUrl}/api/rooms`,
        {
          name: `Ramp-Up Test Room #${roomNumber}`
        },
        {
          headers: {
            'Authorization': `Bearer ${this.adminAuth.token}`
          },
          timeout: 10000
        }
      );
      
      const roomId = response.data.data._id;
      this.metrics.roomsCreated++;
      this.roomsList.push(roomId);
      this.log('success', `Room #${roomNumber} created: ${roomId}`);
      return roomId;

    } catch (error) {
      this.metrics.errorsRoom++;
      this.log('error', `Failed to create room #${roomNumber}:`, error.message);
      throw error;
    }
  }

  generateRandomName() {
    const adjectives = ['Happy', 'Lucky', 'Swift', 'Brave', 'Clever', 'Kind', 'Wise', 'Bold', 'Calm', 'Bright'];
    const nouns = ['Tiger', 'Eagle', 'Dragon', 'Phoenix', 'Wolf', 'Bear', 'Lion', 'Falcon', 'Panda', 'Fox'];
    const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNum = Math.floor(Math.random() * 1000);
    return `${randomAdj} ${randomNoun} ${randomNum}`;
  }

  async getUserProfile(token, sessionId, userId) {
    try {
      const response = await axios.get(
        `${this.config.apiUrl}/api/users/profile`,
        {
          headers: {
            'x-auth-token': token,
            'x-session-id': sessionId
          },
          timeout: 5000
        }
      );
      this.metrics.profileFetches++;
      this.log('info', `User ${userId} fetched profile: ${response.data.data?.name || 'unknown'}`);
      return response.data.data;
    } catch (error) {
      this.log('error', `User ${userId} failed to fetch profile:`, error.message);
      return null;
    }
  }

  async updateUserProfile(token, sessionId, userId, newName) {
    try {
      this.metrics.profileUpdatesAttempted++;
      const response = await axios.put(
        `${this.config.apiUrl}/api/users/profile`,
        { name: newName },
        {
          headers: {
            'x-auth-token': token,
            'x-session-id': sessionId,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );
      this.metrics.profileUpdatesSucceeded++;
      this.log('success', `User ${userId} updated profile name to: ${newName}`);
      return response.data.data;
    } catch (error) {
      this.metrics.profileUpdatesFailed++;
      this.log('error', `User ${userId} failed to update profile:`, error.message);
      return null;
    }
  }

  async uploadFileToChat(socket, token, sessionId, userId, roomId) {
    try {
      // Create form data with the image file
      const formData = new FormData();
      const imagePath = path.join(__dirname, 'profile.png');
      const fileStream = fs.createReadStream(imagePath);
      
      formData.append('file', fileStream, 'profile.png');

      // Upload file to server
      const uploadResponse = await axios.post(
        `${this.config.apiUrl}/api/files/upload`,
        formData,
        {
          headers: {
            'x-auth-token': token,
            'x-session-id': sessionId,
            ...formData.getHeaders()
          },
          timeout: 10000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      if (uploadResponse.data.success && uploadResponse.data.file) {
        const fileData = uploadResponse.data.file;

        // Send file message to chat room via socket
        socket.emit(CLIENT_EMIT.CHAT_MESSAGE, {
          room: roomId,
          type: 'file',
          content: '',
          fileData
        });

        this.metrics.filesUploaded++;
        this.log('success', `User ${userId} uploaded file to room ${roomId}: ${fileData.originalname}`);
        return fileData;
      } else {
        throw new Error('File upload response missing file data');
      }
    } catch (error) {
      this.metrics.fileUploadsFailed++;
      this.log('error', `User ${userId} failed to upload file:`, error.message);
      return null;
    }
  }

  trackConnectionError() {
    const now = Date.now();
    this.recentConnectionErrors.push(now);
    
    // Remove old errors outside the window
    this.recentConnectionErrors = this.recentConnectionErrors.filter(
      time => now - time < this.connectionErrorWindow
    );
    
    // Check if we should activate backpressure
    if (this.recentConnectionErrors.length >= this.connectionErrorThreshold && !this.backpressureActive) {
      this.backpressureActive = true;
      this.backpressureCount++;
      
      this.log('warn', `⚠️ WebSocket connection errors detected (${this.recentConnectionErrors.length} in ${this.connectionErrorWindow}ms). Activating backpressure #${this.backpressureCount}/${this.maxBackpressureCount}`);
      
      // Check if we've exceeded the maximum backpressure count
      if (this.backpressureCount > this.maxBackpressureCount) {
        this.log('error', `❌ Backpressure limit exceeded (${this.maxBackpressureCount}). WebSocket connections are consistently failing. Aborting test.`);
        this.abortTest();
        return;
      }
      
      // Automatically deactivate after a period
      setTimeout(() => {
        this.backpressureActive = false;
        this.recentConnectionErrors = [];
        this.log('info', `✓ Backpressure #${this.backpressureCount} deactivated. Resuming normal user creation rate.`);
      }, this.backpressureDelay * 2);
    }
  }

  async simulateUser(roomId) {
    const connectStartTime = Date.now();
    const userId = uuidv4().substring(0, 8);

    // 온보딩 코호트 타이밍: 도착 시점 + 단계별 소요시간(누적 ms) 기록 (spec §3.2)
    const arrivedAt = connectStartTime;
    const activeUsersAtArrival = this.activeUsers;
    const onboardingStart = arrivedAt;
    const onboardingStages = {};

    try {
      const authData = await this.createTestUser(userId);
      if (!authData) {
        return;
      }

      const { token, sessionId, user } = authData;
      // auth(login/register) 단계 완료 시점 (bcrypt CPU 힌트)
      onboardingStages.auth = Date.now() - onboardingStart;

      // Step 1: REST API - Join Room
      try {
        const restJoinStart = Date.now();
        await axios.post(
          `${this.config.apiUrl}/api/rooms/${roomId}/join`,
          {},
          {
            headers: {
              'x-auth-token': token,
              'x-session-id': sessionId,
              'Content-Type': 'application/json'
            },
            timeout: 5000
          }
        );
        // REST 지연도 restRing에 기록 (spec §3.3 이중 경로)
        addSample(this.metrics.restRing, Date.now() - restJoinStart);
        onboardingStages.rest_join = Date.now() - onboardingStart;
        this.metrics.roomJoinsREST++;
        this.log('info', `User ${userId} joined room ${roomId} via REST API`);
      } catch (error) {
        addError(this.metrics.restRing);
        this.metrics.errorsRoom++;
        this.log('error', `User ${userId} failed to join room via REST API:`, error.message);
        return;
      }

      // Step 2: REST API - Fetch Room Info
      try {
        const restRoomInfoStart = Date.now();
        const roomInfoResponse = await axios.get(
          `${this.config.apiUrl}/api/rooms/${roomId}`,
          {
            headers: {
              'x-auth-token': token,
              'x-session-id': sessionId,
              'Content-Type': 'application/json'
            },
            timeout: 5000
          }
        );
        addSample(this.metrics.restRing, Date.now() - restRoomInfoStart);
        onboardingStages.rest_roominfo = Date.now() - onboardingStart;
        this.metrics.roomInfoFetches++;
        this.log('info', `User ${userId} fetched room info: ${roomInfoResponse.data.name || roomId}`);
      } catch (error) {
        addError(this.metrics.restRing);
        this.metrics.errorsRoom++;
        this.log('error', `User ${userId} failed to fetch room info:`, error.message);
        // Continue even if room info fetch fails
      }

      // Step 3: WebSocket Connection
      const socket = io(this.config.socketUrl, {
        auth: { token, sessionId },
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
        timeout: 10000,
        autoConnect: true
      });

      this.sockets.push(socket);

      socket.on('connect', () => {
        const connectionTime = Date.now() - connectStartTime;
        this.metrics.connected++;
        this.activeUsers++;
        this.metrics.connectionTimes.push(connectionTime);
        onboardingStages.socket_connect = Date.now() - onboardingStart;
        this.log('success', `User ${userId} (${user.name}) connected in ${connectionTime}ms`);

        // Step 4: WebSocket - Join Room
        socket.emit(CLIENT_EMIT.JOIN_ROOM, roomId);
      });

      socket.on(SERVER_EMIT.JOIN_ROOM_SUCCESS, (data) => {
        this.log('info', `User ${userId} joined room ${roomId} via WebSocket`);

        // TTI(도착~첫 메시지 성공 기준점)로 joinRoomSuccess 시점을 기록하고,
        // 코호트를 도착 시점의 활성 사용자 수로 태깅해 온보딩 P95 산출에 쓴다.
        onboardingStages.tti = Date.now() - onboardingStart;
        this.metrics.onboardingCohorts.push({
          arrivedAt,
          activeUsersAtArrival,
          stages: onboardingStages
        });

        // Step 5: WebSocket - Fetch Previous Messages
        socket.emit(CLIENT_EMIT.FETCH_PREVIOUS_MESSAGES, {
          roomId: roomId,
          limit: 30
        });

        // Start continuous message sending
        this.startContinuousMessaging(socket, userId, roomId, token, sessionId);
      });

      socket.on(SERVER_EMIT.JOIN_ROOM_ERROR, (error) => {
        this.metrics.errorsConnection++;
        this.log('error', `User ${userId} failed to join room:`, error.message || JSON.stringify(error));
        socket.close();
      });

      socket.on(SERVER_EMIT.PREVIOUS_MESSAGES_LOADED, (data) => {
        const messageCount = data.messages?.length || 0;
        this.metrics.previousMessagesFetched++;
        this.log('info', `User ${userId} received ${messageCount} previous messages`);
        // Count as received messages
        if (messageCount > 0) {
          this.metrics.messagesReceived += messageCount;
        }
      });

      socket.on(SERVER_EMIT.MESSAGE, (data) => {
        this.metrics.messagesReceived++;

        // echo RTT: 내가 보낸 메시지가 broadcast로 되돌아온 것만 상관한다.
        // 서버 message 이벤트의 sender는 UserResponse 객체(id로 직렬화)이고,
        // 로그인 응답의 user는 AuthUserDto(@JsonProperty("_id"))라 서버 id가 _id에
        // 담긴다. 그래서 (data.sender === userId) 참조코드는 물론 sender.id===user.id도
        // 어긋난다 — sender.id는 user._id와 비교해야 매칭된다.
        // 같은 방의 다른 사용자 메시지도 broadcast로 수신되므로 이 필터가 필수.
        const myServerId = user._id || user.id;
        if (data.content && data.sender && data.sender.id === myServerId) {
          const match = String(data.content).match(/__ts(\d+)__/);
          if (match) {
            const rtt = Date.now() - Number(match[1]);
            if (rtt >= 0) {
              addSample(this.metrics.socketRing, rtt);
            }
          }
        }

        if (data._id) {
          socket.emit(CLIENT_EMIT.MARK_MESSAGES_AS_READ, {
            messageIds: [data._id]
          });
          this.metrics.messagesRead++;
        }

        // 수신 메시지의 10%에 리액션을 단다. 서버는 방 전체에 messageReactionUpdate를
        // 브로드캐스트하므로 수신 카운터가 송신보다 훨씬 크게 나오는 것이 정상이다.
        if (data._id && Math.random() < 0.1) {
          socket.emit(CLIENT_EMIT.MESSAGE_REACTION, {
            messageId: data._id,
            reaction: '👍',
            type: 'add'
          });
          this.metrics.reactionsSent++;
        }
      });

      socket.on(SERVER_EMIT.MESSAGES_READ, (data) => {
        this.metrics.readAcksReceived++;
      });

      socket.on(SERVER_EMIT.MESSAGE_REACTION_UPDATE, (data) => {
        this.metrics.reactionUpdatesReceived++;
      });

      socket.on(SERVER_EMIT.PARTICIPANTS_UPDATE, (data) => {
        this.metrics.participantsUpdatesReceived++;
      });

      socket.on(SERVER_EMIT.SESSION_ENDED, (data) => {
        this.metrics.sessionEndedReceived++;
        this.log('info', `User ${userId} session ended: ${data?.reason || 'unknown'}`);
      });

      socket.on(SERVER_EMIT.ERROR, (error) => {
        // MESSAGE_REJECTED
        this.metrics.errorsMessage++;
        this.log('error', `User ${userId} received error: ${error.message || JSON.stringify(error)}`);
      });

      socket.on('disconnect', (reason, desc) => {
        this.metrics.disconnected++;
        this.activeUsers = Math.max(0, this.activeUsers - 1);
        const socketIndex = this.sockets.indexOf(socket);
        if (socketIndex !== -1) {
          this.sockets.splice(socketIndex, 1);
        }
        // reason 별 메트릭 세분화
        switch (reason) {
          case 'io server disconnect':
            this.metrics.disconnectedByServer = (this.metrics.disconnectedByServer || 0) + 1;
            break;
          case 'io client disconnect':
            this.metrics.disconnectedByClient = (this.metrics.disconnectedByClient || 0) + 1;
            break;
          case 'ping timeout':
            this.metrics.disconnectedByPingTimeout = (this.metrics.disconnectedByPingTimeout || 0) + 1;
            break;
          default:
            this.metrics.disconnectedOther = (this.metrics.disconnectedOther || 0) + 1;
        }
        
        let descStr;
        try {
          descStr = desc ? JSON.stringify(desc) : '';
        } catch {
          descStr = '[unserializable desc]';
        }
        
        this.log('warn', `User ${userId} disconnected. reason=${reason} desc=${descStr}`);
      });

      socket.on('connect_error', (error) => {
        this.metrics.errorsConnection++;
        this.trackConnectionError();
        // socket.active:
        //  - true  : 네트워크 문제 (자동 재연결 대상이지만, 지금은 reconnection=false라 의미만 참고)
        //  - false : 서버에서 연결 거부 (인증 실패 등)
        const phase = socket.active ? 'network_or_transport' : 'server_rejected';

        let descStr = '';
        try {
          const info = {
            message: error?.message,
            description: error?.description,
            context: error?.context && {
              status: error?.context?.status,
            },
          };
          descStr = JSON.stringify(info);
        } catch {
          descStr = '[unserializable error]';
        }

        this.log('error', `User ${userId} connection error. phase=${phase} detail=${descStr}`);

        // 이 소켓은 더 쓰지 않으니까 명시적으로 정리
        try {
          socket.close();
        } catch {
          // 이미 닫혀 있어도 무시
        }
      });

    } catch (error) {
      this.metrics.errorsConnection++;
      this.trackConnectionError();
      this.log('error', `User ${userId} simulation failed:`, error.message);
    }
  }

  startContinuousMessaging(socket, userId, roomId, token, sessionId) {
    let messageCount = 0;

    const sendMessage = async () => {
      if (!socket.connected) {
        return;
      }

      try {
        // content에 송신 시각을 __ts<epoch>__로 실어 echo RTT를 상관한다.
        // (기존 emit 직후 시간차 측정은 로컬 큐잉 시간이라 폐기 — spec §1.1/§3.3)
        const ts = Date.now();
        socket.emit(CLIENT_EMIT.CHAT_MESSAGE, {
          room: roomId,
          type: 'text',
          content: `__ts${ts}__ Ramp-up test message from user ${userId}`
        });

        this.metrics.messagesSent++;
        messageCount++;

        // Update profile every 10 messages
        if (messageCount % 10 === 0) {
          this.log('info', `User ${userId} reached ${messageCount} messages, updating profile...`);
          const newName = this.generateRandomName();
          await this.updateUserProfile(token, sessionId, userId, newName);
        }

        // Upload image to chat every 17 messages
        if (messageCount % 17 === 0) {
          this.log('info', `User ${userId} reached ${messageCount} messages, uploading image...`);
          await this.uploadFileToChat(socket, token, sessionId, userId, roomId);
        }

      } catch (error) {
        this.metrics.errorsMessage++;
        this.log('error', `User ${userId} failed to send message:`, error.message);
      }

      // Schedule next message with random interval
      const delay = Math.random() *
        (this.config.messageIntervalMax - this.config.messageIntervalMin) +
        this.config.messageIntervalMin;

      setTimeout(sendMessage, delay);
    };

    // Start sending messages immediately
    sendMessage();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printMetrics() {
    const elapsed = ((Date.now() - this.metrics.startTime) / 1000).toFixed(1);

    // 대시보드 지연 표시는 socketRing(echo RTT 슬라이딩 윈도우) 기반으로 산출한다.
    // 기존 latencies 배열(가짜 emit 큐잉 시간)은 폐기됐다 — spec §1.1/§3.3.
    const socketSnap = snapshot(this.metrics.socketRing, Date.now());
    const ringValues = this.metrics.socketRing.samples.map(s => s.value);
    const avgLatency = ringValues.length > 0
      ? (ringValues.reduce((a, b) => a + b, 0) / ringValues.length).toFixed(2)
      : 0;
    const p95Latency = socketSnap.count > 0 ? socketSnap.p95.toFixed(2) : 0;
    const p99Latency = socketSnap.count > 0 ? socketSnap.p99.toFixed(2) : 0;

    const avgConnectionTime = this.metrics.connectionTimes.length > 0
      ? (this.metrics.connectionTimes.reduce((a, b) => a + b, 0) / this.metrics.connectionTimes.length).toFixed(2)
      : 0;

    let phaseInfo = '';
    let timeRemaining = '';

    if (this.metrics.currentPhase === 'ramping-up') {
      const rampUpElapsed = ((Date.now() - this.metrics.rampUpStartTime) / 1000).toFixed(1);
      const usersToGo = this.config.maxUsers - this.activeUsers;
      phaseInfo = chalk.yellow(`Ramping Up (${rampUpElapsed}s) - ${usersToGo} users to go`);
    } else if (this.metrics.currentPhase === 'sustaining') {
      const sustainElapsed = ((Date.now() - this.metrics.maxUsersReachedTime) / 1000).toFixed(1);
      const remainingTime = Math.max(0, this.config.sustainDuration - sustainElapsed).toFixed(1);
      phaseInfo = chalk.green(`Sustaining Max Load (${sustainElapsed}s / ${this.config.sustainDuration}s)`);
      timeRemaining = `${remainingTime}s remaining`;
    } else if (this.metrics.currentPhase === 'completed') {
      phaseInfo = chalk.cyan('Test Completed');
    } else if (this.metrics.currentPhase === 'aborted') {
      phaseInfo = chalk.red('Test Aborted');
    }

    const table = new Table({
      head: [
        chalk.cyan('Metric'), chalk.cyan('Value'),
        chalk.cyan('Metric'), chalk.cyan('Value')
      ],
      colWidths: [28, 18, 28, 18]
    });

    const totalErrors = this.metrics.errorsRoom + this.metrics.errorsAuth +
                       this.metrics.errorsConnection + this.metrics.errorsMessage;

    table.push(
      ['Test Phase', phaseInfo, chalk.green('Rooms Created'), this.metrics.roomsCreated],
      ['Elapsed Time', `${elapsed}s`, chalk.green('Users Created'), this.metrics.usersCreated],
      ...(timeRemaining ? [['Time Remaining', timeRemaining, chalk.green('Active Users'), this.activeUsers]] : [['', '', chalk.green('Active Users'), this.activeUsers]]),
      ...(this.backpressureCount > 0 ? [[chalk.yellow('Backpressure Count'), `${this.backpressureCount}/${this.maxBackpressureCount}`, chalk.green('Connected'), this.metrics.connected]] : [['', '', chalk.green('Connected'), this.metrics.connected]]),
      ['───────────────', '──────────', '───────────────', '──────────'],
      [chalk.cyan('Room Joins (REST)'), this.metrics.roomJoinsREST, chalk.green('Messages Sent'), this.metrics.messagesSent],
      [chalk.cyan('Room Info Fetches'), this.metrics.roomInfoFetches, chalk.green('Messages Received'), this.metrics.messagesReceived],
      [chalk.cyan('Prev Msgs Fetched'), this.metrics.previousMessagesFetched, chalk.cyan('Messages Read'), this.metrics.messagesRead],
      ['', '', chalk.cyan('Read Acks Received'), this.metrics.readAcksReceived],
      ['', '', 'Messages/sec', (this.metrics.messagesSent / elapsed).toFixed(2)],
      [chalk.cyan('Reactions Sent'), this.metrics.reactionsSent, chalk.cyan('Reaction Updates Recv'), this.metrics.reactionUpdatesReceived],
      [chalk.cyan('Participants Updates'), this.metrics.participantsUpdatesReceived, chalk.cyan('Session Ended Recv'), this.metrics.sessionEndedReceived],
      ['───────────────', '──────────', '───────────────', '──────────'],
      [chalk.cyan('Profile Fetches'), this.metrics.profileFetches, chalk.cyan('Profile Updates'), this.metrics.profileUpdatesAttempted],
      [chalk.cyan('└─ Succeeded'), this.metrics.profileUpdatesSucceeded, chalk.cyan('└─ Failed'), this.metrics.profileUpdatesFailed],
      ['───────────────', '──────────', '───────────────', '──────────'],
      [chalk.cyan('Files Uploaded'), this.metrics.filesUploaded, chalk.cyan('File Upload Fails'), this.metrics.fileUploadsFailed],
      ['───────────────', '──────────', '───────────────', '──────────'],
      [chalk.yellow('Total Disconnected'), this.metrics.disconnected, 'Avg Msg Latency', `${avgLatency}ms`],
      [chalk.yellow('└─ By Server'), this.metrics.disconnectedByServer, 'P95 Msg Latency', `${p95Latency}ms`],
      [chalk.yellow('└─ By Client'), this.metrics.disconnectedByClient, 'P99 Msg Latency', `${p99Latency}ms`],
      [chalk.yellow('└─ Ping Timeout'), this.metrics.disconnectedByPingTimeout, 'Avg Conn Time', `${avgConnectionTime}ms`],
      [chalk.yellow('└─ Other'), this.metrics.disconnectedOther, '', ''],
      ['───────────────', '──────────', '───────────────', '──────────'],
      [chalk.red('Room Errors'), this.metrics.errorsRoom, chalk.red('Auth Errors'), this.metrics.errorsAuth],
      [chalk.red('Connection Errors'), this.metrics.errorsConnection, chalk.red('Message Errors'), this.metrics.errorsMessage],
      ['', '', chalk.red('Total Errors'), totalErrors]
    );

    console.clear();
    console.log(chalk.bold.cyan('\n=== KTB Chat Ramp-Up Load Test - Real-time Metrics ===\n'));
    console.log(table.toString());
    console.log('');

    if (this.logBuffer.length > 0) {
      console.log(chalk.bold.white('Recent Activity:'));
      console.log(chalk.gray('─'.repeat(80)));
      this.logBuffer.forEach(({ level, message }) => {
        switch (level) {
          case 'info':
            console.log(chalk.blue(message));
            break;
          case 'success':
            console.log(chalk.green(message));
            break;
          case 'warn':
            console.log(chalk.yellow(message));
            break;
          case 'error':
            console.log(chalk.red(message));
            break;
          default:
            console.log(message);
        }
      });
      console.log(chalk.gray('─'.repeat(80)));
    }
  }

  getPercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  // 윈도우 지표 수집 — 소켓/REST 링 스냅샷 + 온보딩 코호트 P95 + 하드신호 증분.
  // 반환 객체는 detector 계약(socketP95/restP95/errorRate/pingTimeoutIncrement/
  // serverDisconnectIncrement/activeUsers/onboardingP95)의 상위집합이며, CSV 기록용
  // p50/p99·msg/sec·epoch도 함께 담는다. 이 객체가 곧 노드→컨트롤러 전송 페이로드다.
  collectWindowStats() {
    const now = Date.now();
    const socketStats = snapshot(this.metrics.socketRing, now);
    const restStats = snapshot(this.metrics.restRing, now);
    const elapsed = ((now - this.metrics.startTime) / 1000).toFixed(1);

    // 최근 5초에 도착한 코호트의 온보딩 TTI 백분위
    const recentCohorts = this.metrics.onboardingCohorts.filter(
      (c) => c.arrivedAt > now - 5000
    );
    const ttiValues = recentCohorts
      .map((c) => c.stages.tti ?? 0)
      .filter((v) => v > 0);
    const onboardingP50 = this.getPercentile(ttiValues, 50);
    const onboardingP95 = this.getPercentile(ttiValues, 95);
    const onboardingP99 = this.getPercentile(ttiValues, 99);

    // 하드 신호는 누적 카운터의 윈도우 증분으로 계산
    const pingTimeoutIncrement =
      (this.metrics.disconnectedByPingTimeout || 0) - this.metrics.pingTimeoutPrev;
    const serverDisconnectIncrement =
      (this.metrics.disconnectedByServer || 0) - this.metrics.serverDisconnectPrev;
    this.metrics.pingTimeoutPrev = this.metrics.disconnectedByPingTimeout || 0;
    this.metrics.serverDisconnectPrev = this.metrics.disconnectedByServer || 0;

    return {
      nodeId: this.nodeId,
      epochMs: now,
      elapsed,
      activeUsers: this.activeUsers,
      msgPerSec: socketStats.count / 5,
      onboardingP50,
      onboardingP95,
      onboardingP99,
      socketP50: socketStats.p50,
      socketP95: socketStats.p95,
      socketP99: socketStats.p99,
      restP50: restStats.p50,
      restP95: restStats.p95,
      restP99: restStats.p99,
      errorRate: socketStats.errorRate,
      pingTimeoutIncrement,
      serverDisconnectIncrement,
    };
  }

  // 판정 + 기록 — timeline.csv append, 상태기계 평가, breaking-point.json 기록,
  // post_observe 관찰 종료 시 자동 중단. (다중 노드에서는 컨트롤러가 담당할 책임)
  evaluateAndRecord(windowStats) {
    const now = windowStats.epochMs;

    // CSV append (spec §5.6 컬럼 순서 + node_id). Prometheus 컬럼은 collect.py가 사후 병합.
    if (this.timelinePath) {
      const row = [
        windowStats.nodeId,
        now,
        windowStats.elapsed,
        windowStats.activeUsers,
        windowStats.msgPerSec.toFixed(2),
        windowStats.onboardingP50,
        windowStats.onboardingP95,
        windowStats.onboardingP99,
        windowStats.socketP50,
        windowStats.socketP95,
        windowStats.socketP99,
        windowStats.restP50,
        windowStats.restP95,
        windowStats.restP99,
        (windowStats.errorRate * 100).toFixed(2),
        windowStats.pingTimeoutIncrement,
        windowStats.serverDisconnectIncrement,
      ].join(',');
      try {
        fs.appendFileSync(this.timelinePath, row + '\n');
      } catch (error) {
        this.log('error', `Failed to append timeline row:`, error.message);
      }
    }

    // 상태기계: baseline 확정 전엔 calibrate, 확정 후엔 evaluate(now 필수 인자).
    let evalResult;
    if (this.detector.baseline === null) {
      calibrate(this.detector, windowStats);
      evalResult = { state: 'calibrating' };
    } else {
      evalResult = evaluate(this.detector, windowStats, now);
    }

    if (evalResult.state === 'breached' && !this._breachRecorded) {
      this._breachRecorded = true;
      const bp = {
        node_id: windowStats.nodeId,
        breaking_point_users: evalResult.breakingPointUsers,
        first_breach_signal: evalResult.breachSignal,
        breach_confirmed_at_ms: now,
      };
      if (this.breakingPointPath) {
        try {
          fs.writeFileSync(this.breakingPointPath, JSON.stringify(bp, null, 2));
        } catch (error) {
          this.log('error', `Failed to write breaking-point.json:`, error.message);
        }
      }
      this.log(
        'warn',
        `⚠️ BREAKPOINT DETECTED: ${evalResult.breakingPointUsers} users, signal=${evalResult.breachSignal}`
      );
    }

    // post_observe 관찰 종료 시 자동 중단 (상태기계가 postBreachMs 경과를 판정)
    if (
      evalResult.state === 'post_observe' &&
      evalResult.shouldStop &&
      !this._shuttingDown
    ) {
      this.log('info', '⏹ Post-observe complete. Stopping test.');
      this.onSustainComplete();
    }
  }

  async startRampUp() {
    this.metrics.currentPhase = 'ramping-up';
    this.metrics.rampUpStartTime = Date.now();

    // 5초 윈도우 플러시: 수집(collectWindowStats)과 판정·기록(evaluateAndRecord)을
    // 두 단계로 분리 호출한다. 이 경계가 향후 부하 노드↔컨트롤러 프로세스 경계가 된다.
    this.windowFlushInterval = setInterval(() => {
      const windowStats = this.collectWindowStats();
      this.evaluateAndRecord(windowStats);
    }, 5000);

    let roomCounter = 1;

    this.userSpawnInterval = setInterval(async () => {
      // Check if backpressure is active
      if (this.backpressureActive) {
        this.log('info', `⏸️ Backpressure active - skipping user creation this cycle`);
        return;
      }

      // Check if we've reached max users
      if (this.activeUsers >= this.config.maxUsers) {
        clearInterval(this.userSpawnInterval);
        this.onMaxUsersReached();
        return;
      }

      // Random number of users to spawn (between min and max per second)
      const usersToSpawn = Math.floor(
        Math.random() * (this.config.maxUsersPerSecond - this.config.minUsersPerSecond + 1)
      ) + this.config.minUsersPerSecond;

      const actualUsersToSpawn = Math.min(usersToSpawn, this.config.maxUsers - this.activeUsers);

      try {
        // Create a new room for this batch
        const newRoomId = await this.createNewRoom(roomCounter);
        roomCounter++;

        this.log('info', `Spawning ${actualUsersToSpawn} users in room #${roomCounter - 1}...`);

        // Spawn all users in this batch to the same room
        for (let i = 0; i < actualUsersToSpawn; i++) {
          // Add small delay between user spawns if backpressure was recently active
          if (this.recentConnectionErrors.length > 0) {
            await this.sleep(50); // 50ms delay between users
          }
          this.simulateUser(newRoomId);
        }
      } catch (error) {
        this.log('error', `Failed to create room or spawn users:`, error.message);
      }
    }, 1000); // Every 1 second
  }

  onMaxUsersReached() {
    this.log('success', `Maximum users (${this.config.maxUsers}) reached! Starting sustain phase...`);
    this.metrics.currentPhase = 'sustaining';
    this.metrics.maxUsersReachedTime = Date.now();

    // Set timer for sustain duration
    this.sustainTimer = setTimeout(() => {
      this.onSustainComplete();
    }, this.config.sustainDuration * 1000);
  }

  abortTest() {
    this.log('error', 'Aborting test due to excessive connection failures...');
    this.metrics.currentPhase = 'aborted';

    // Clear all intervals and timers
    if (this.userSpawnInterval) {
      clearInterval(this.userSpawnInterval);
    }
    if (this.windowFlushInterval) {
      clearInterval(this.windowFlushInterval);
    }
    if (this.sustainTimer) {
      clearTimeout(this.sustainTimer);
    }

    // Disconnect all sockets
    this.sockets.forEach(socket => {
      if (socket.connected) {
        socket.close();
      }
    });

    // Wait a bit for graceful disconnection
    setTimeout(() => {
      clearInterval(this.metricsInterval);
      this.printMetrics();
      console.log(chalk.bold.red('\n✗ Test aborted due to excessive WebSocket connection failures!\n'));
      process.exit(1);
    }, 2000);
  }

  onSustainComplete() {
    // sustainTimer와 post_observe(shouldStop) 양쪽에서 호출될 수 있어 재진입 방지
    if (this._shuttingDown) return;
    this._shuttingDown = true;
    this.log('success', `Sustain phase complete (${this.config.sustainDuration}s). Shutting down all users...`);
    this.metrics.currentPhase = 'completed';

    // 모든 타이머 정리 — 임계점이 rampup 도중 확정되면 userSpawnInterval도 아직 살아있다.
    if (this.userSpawnInterval) {
      clearInterval(this.userSpawnInterval);
    }
    if (this.windowFlushInterval) {
      clearInterval(this.windowFlushInterval);
    }
    if (this.sustainTimer) {
      clearTimeout(this.sustainTimer);
    }

    // Disconnect all sockets simultaneously
    this.sockets.forEach(socket => {
      if (socket.connected) {
        socket.close();
      }
    });

    // Wait a bit for graceful disconnection
    setTimeout(() => {
      clearInterval(this.metricsInterval);
      this.printMetrics();
      console.log(chalk.bold.green('\n✓ Ramp-up load test completed!\n'));
      process.exit(0);
    }, 2000);
  }

  async run() {
    const { maxUsers, minUsersPerSecond, maxUsersPerSecond, sustainDuration } = this.config;

    // 출력 디렉토리 설정 (BP_OUTPUT_DIR 환경변수 또는 기본 results/<날짜>_manual)
    const outputDir = process.env.BP_OUTPUT_DIR
      || path.join(__dirname, 'results', `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_manual`);
    fs.mkdirSync(outputDir, { recursive: true });
    this.runOutputDir = outputDir;
    this.timelinePath = path.join(outputDir, 'timeline.csv');
    this.breakingPointPath = path.join(outputDir, 'breaking-point.json');

    // timeline.csv 헤더 (spec §5.6 컬럼 + node_id). Prometheus 컬럼은 collect.py가 사후 병합.
    const csvHeader = 'node_id,epoch_ms,elapsed_s,active_users,msg_per_sec,' +
      'onboarding_p50,onboarding_p95,onboarding_p99,' +
      'socket_p50,socket_p95,socket_p99,' +
      'rest_p50,rest_p95,rest_p99,' +
      'error_rate_pct,ping_timeout_incr,server_disconnect_incr\n';
    fs.writeFileSync(this.timelinePath, csvHeader);

    console.log(chalk.bold.cyan('\n=== KTB Chat Ramp-Up Load Test ===\n'));
    console.log(chalk.white('Configuration:'));
    console.log(chalk.gray(`  Max Users:              ${maxUsers}`));
    console.log(chalk.gray(`  Users/sec (range):      ${minUsersPerSecond}-${maxUsersPerSecond}`));
    console.log(chalk.gray(`  Sustain Duration:       ${sustainDuration}s (${(sustainDuration / 60).toFixed(1)} min)`));
    console.log(chalk.gray(`  Message Interval:       ${this.config.messageIntervalMin}-${this.config.messageIntervalMax}ms`));
    console.log(chalk.gray(`  API URL:                ${this.config.apiUrl}`));
    console.log(chalk.gray(`  Socket.IO URL:          ${this.config.socketUrl}`));
    console.log(chalk.gray(`  Strategy:               1 new room per second with ${minUsersPerSecond}-${maxUsersPerSecond} users`));
    console.log('');

    // Create admin user for room creation
    try {
      this.adminAuth = await this.createAdminUser();
    } catch (error) {
      this.log('error', 'Failed to create admin user. Aborting test.');
      process.exit(1);
    }

    const estimatedRooms = Math.ceil(maxUsers / ((minUsersPerSecond + maxUsersPerSecond) / 2));

    this.log('info', `Starting ramp-up load test`);
    this.log('info', `Target: ${maxUsers} users in ~${estimatedRooms} rooms`);
    this.log('info', `Strategy: Creating 1 new room per second with ${minUsersPerSecond}-${maxUsersPerSecond} users`);
    this.log('info', `Will sustain for ${sustainDuration}s after reaching max users`);

    // Show initial metrics
    this.printMetrics();

    // Start metrics reporting
    this.metricsInterval = setInterval(() => this.printMetrics(), 2000);

    // Start ramping up users and rooms
    await this.startRampUp();
  }
}

// Main execution
const tester = new RampUpLoadTester({
  apiUrl: argv.apiUrl,
  socketUrl: argv.socketUrl,
  roomId: argv.roomId,
  maxUsers: argv.maxUsers,
  minUsersPerSecond: argv.minUsersPerSecond,
  maxUsersPerSecond: argv.maxUsersPerSecond,
  sustainDuration: argv.sustainDuration,
  messageIntervalMin: argv.messageIntervalMin,
  messageIntervalMax: argv.messageIntervalMax
});

tester.run().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
