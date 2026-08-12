import { renderHook, waitFor } from '@testing-library/react';
import socketClient from '@/lib/socket/socketClient';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatRoomLifecycle } from '../useChatRoomLifecycle';

/**
 * 재연결 창 안에 서버가 돌아온 뒤(5-a) 새로고침 없이 다시 끊기는(5-b) 흐름의 계약.
 *
 * socket.io 의 manager 'reconnect' 는 engine open 직후 — 서버의 CONNECT 응답 전 —
 * 발생하므로 그 시점 socket.connected 는 아직 false 다. 여기서 방 세팅을 처음부터
 * 다시 하면 setupSocket 이 살아 있는 소켓을 버리고 새 소켓을 만들어 버린다.
 */
const { setupRoomMock, rejoinRoomMock } = vi.hoisted(() => ({
  setupRoomMock: vi.fn(),
  rejoinRoomMock: vi.fn(),
}));

vi.mock('../useRoomHandling', () => ({
  useRoomHandling: vi.fn(() => ({
    setupRoom: setupRoomMock,
    rejoinRoom: rejoinRoomMock,
    loadInitialMessages: vi.fn(),
  })),
}));

vi.mock('@/lib/socket/socketClient', () => ({
  default: {
    subscribeConnectionEvents: vi.fn(() => vi.fn()),
    tryLeaveRoom: vi.fn(),
  },
}));

const createHarness = ({ socketRef, state: stateOverrides = {}, refs: refOverrides = {} }) => {
  const state = {
    currentUser: { id: 'user-1' },
    messages: [],
    isInitialized: true,
    loading: false,
    error: '',
    connectionStatus: 'connected',
    ...stateOverrides,
  };
  const refs = {
    socketRef,
    attachSocket: (socket) => {
      socketRef.current = socket;
    },
    mountedRef: { current: true },
    initializingRef: { current: false },
    // 끊김이 감지되면 lifecycle 이 이 플래그를 내린다.
    setupCompleteRef: { current: false },
    userRooms: { current: new Map() },
    processedMessageIds: { current: new Set() },
    messageProcessingRef: { current: false },
    initialLoadCompletedRef: { current: false },
    loadMoreTimeoutRef: { current: null },
    previousMessagesRef: { current: new Set() },
    messageLoadAttemptRef: { current: 0 },
    cleanupInProgressRef: { current: false },
    ...refOverrides,
  };
  const actions = {
    setRoom: vi.fn(),
    setError: vi.fn(),
    setMessages: vi.fn(),
    setHasMoreMessages: vi.fn(),
    setLoadingMessages: vi.fn(),
    setCurrentUser: vi.fn(),
    connectionEstablished: vi.fn(),
    connectionLost: vi.fn(),
    connectionFailed: vi.fn(),
    connectionReconnecting: vi.fn(),
    connectionRecovered: vi.fn(),
  };

  // 실제 앱에서 이 값들은 useState setter/useCallback 이라 렌더마다 바뀌지 않는다.
  // 렌더마다 새 함수를 넘기면 effect 가 매번 재구독돼 구독 유실이 가려진다.
  const route = { onNavigate: vi.fn(), onReplace: vi.fn(), asPath: '/chat/room-1' };
  const authUser = { id: 'user-1' };
  const setConnected = vi.fn();
  const cleanup = vi.fn();
  const handleReactionUpdate = vi.fn();

  const hook = renderHook(() =>
    useChatRoomLifecycle({
      roomId: 'room-1',
      route,
      state,
      refs,
      actions,
      authUser,
      activeSocket: socketRef.current,
      setConnected,
      cleanup,
      handleReactionUpdate,
    })
  );

  return { ...hook, state, refs, actions };
};

const connectionHandlers = () =>
  socketClient.subscribeConnectionEvents.mock.calls.at(-1)[1];

describe('useChatRoomLifecycle — 재연결', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketClient.subscribeConnectionEvents.mockReturnValue(vi.fn());
    setupRoomMock.mockResolvedValue(undefined);
    rejoinRoomMock.mockResolvedValue(undefined);
  });

  it('재연결된 소켓은 버리지 않고 방에만 다시 입장한다', async () => {
    const socketRef = { current: { id: 'socket-A', connected: true } };
    createHarness({ socketRef });

    await waitFor(() => {
      expect(socketClient.subscribeConnectionEvents).toHaveBeenCalled();
    });

    const handlers = connectionHandlers();
    // manager 'reconnect' — 이 시점 socket.connected 는 아직 false 다.
    socketRef.current.connected = false;
    handlers.onReconnect();
    // 서버 CONNECT 응답이 도착해 socket 이 실제로 붙는다.
    socketRef.current.connected = true;
    handlers.onConnect();

    await waitFor(() => {
      expect(rejoinRoomMock).toHaveBeenCalledTimes(1);
    });

    expect(setupRoomMock).not.toHaveBeenCalled();
  });

  it('최초 연결은 방 세팅 전체를 돌린다', async () => {
    const socketRef = { current: { id: 'socket-A', connected: true } };
    createHarness({ socketRef, state: { isInitialized: false } });

    await waitFor(() => {
      expect(socketClient.subscribeConnectionEvents).toHaveBeenCalled();
    });

    connectionHandlers().onConnect();

    await waitFor(() => {
      expect(setupRoomMock).toHaveBeenCalled();
    });

    expect(rejoinRoomMock).not.toHaveBeenCalled();
  });

});
