import { renderHook, waitFor } from '@testing-library/react';
import socketClient from '@/lib/socket/socketClient';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatRoomLifecycle } from '../useChatRoomLifecycle';

// 실제 앱에서 이 함수들은 useCallback 이라 렌더마다 바뀌지 않는다.
// 렌더마다 새 함수를 내보내면 effect 가 매번 재구독돼 구독 유실이 가려진다.
const { setupRoomMock, rejoinRoomMock, loadInitialMessagesMock } = vi.hoisted(() => ({
  setupRoomMock: vi.fn(),
  rejoinRoomMock: vi.fn(),
  loadInitialMessagesMock: vi.fn(),
}));

vi.mock('../useRoomHandling', () => ({
  useRoomHandling: vi.fn(() => ({
    setupRoom: setupRoomMock,
    rejoinRoom: rejoinRoomMock,
    loadInitialMessages: loadInitialMessagesMock,
  })),
}));

vi.mock('@/lib/socket/socketClient', () => ({
  default: {
    subscribeConnectionEvents: vi.fn(() => vi.fn()),
    tryLeaveRoom: vi.fn(),
  },
}));

/**
 * 소켓이 교체되는 경로가 남아 있어도 끊김 감지를 잃지 않기 위한 안전망.
 * 연결 이벤트 구독은 ref 가 아니라 활성 소켓 자체에 묶여 있어야 한다.
 */
const createHarness = ({ socket }) => {
  const socketRef = { current: socket };
  const state = {
    currentUser: { id: 'user-1' },
    messages: [],
    isInitialized: true,
    loading: false,
    error: '',
    connectionStatus: 'connected',
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
  // refs 도 렌더마다 새로 만들면 effect 가 매번 재구독돼 구독 유실이 가려진다.
  const refs = {
    socketRef,
    attachSocket: (next) => {
      socketRef.current = next;
    },
    mountedRef: { current: true },
    initializingRef: { current: false },
    setupCompleteRef: { current: true },
    userRooms: { current: new Map() },
    processedMessageIds: { current: new Set() },
    messageProcessingRef: { current: false },
    initialLoadCompletedRef: { current: false },
    loadMoreTimeoutRef: { current: null },
    previousMessagesRef: { current: new Set() },
    messageLoadAttemptRef: { current: 0 },
    cleanupInProgressRef: { current: false },
  };

  const hook = renderHook(
    ({ activeSocket }) =>
      useChatRoomLifecycle({
        roomId: 'room-1',
        route,
        state,
        refs,
        actions,
        authUser,
        activeSocket,
        setConnected,
        cleanup,
        handleReactionUpdate,
      }),
    { initialProps: { activeSocket: socket } }
  );

  return { ...hook, socketRef, actions };
};

describe('useChatRoomLifecycle — 소켓 교체', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketClient.subscribeConnectionEvents.mockReturnValue(vi.fn());
  });

  it('교체된 소켓으로 연결 이벤트를 다시 구독한다', async () => {
    const staleSocket = { id: 'socket-A', connected: true };
    const liveSocket = { id: 'socket-B', connected: true };

    const harness = createHarness({ socket: staleSocket });

    await waitFor(() => {
      expect(socketClient.subscribeConnectionEvents).toHaveBeenCalledWith(
        staleSocket,
        expect.any(Object),
      );
    });

    harness.socketRef.current = liveSocket;
    harness.rerender({ activeSocket: liveSocket });

    await waitFor(() => {
      expect(socketClient.subscribeConnectionEvents).toHaveBeenCalledWith(
        liveSocket,
        expect.any(Object),
      );
    });
  });

  it('교체된 소켓의 끊김이 연결 상태에 반영된다', async () => {
    const staleSocket = { id: 'socket-A', connected: true };
    const liveSocket = { id: 'socket-B', connected: true };

    const harness = createHarness({ socket: staleSocket });

    await waitFor(() => {
      expect(socketClient.subscribeConnectionEvents).toHaveBeenCalled();
    });

    harness.socketRef.current = liveSocket;
    harness.rerender({ activeSocket: liveSocket });

    await waitFor(() => {
      expect(socketClient.subscribeConnectionEvents).toHaveBeenCalledWith(
        liveSocket,
        expect.any(Object),
      );
    });

    const handlers = socketClient.subscribeConnectionEvents.mock.calls.at(-1)[1];
    handlers.onDisconnect();

    expect(harness.actions.connectionLost).toHaveBeenCalled();
  });
});
