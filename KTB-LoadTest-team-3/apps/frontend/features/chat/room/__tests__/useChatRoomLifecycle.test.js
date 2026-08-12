import { renderHook, waitFor } from '@testing-library/react';
import socketClient from '@/lib/socket/socketClient';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatRoomLifecycle } from '../useChatRoomLifecycle';

vi.mock('../useRoomHandling', () => ({
  useRoomHandling: vi.fn(() => ({
    setupRoom: vi.fn(() => Promise.resolve()),
    loadInitialMessages: vi.fn(),
  })),
}));

vi.mock('@/lib/socket/socketClient', () => ({
  default: {
    subscribeConnectionEvents: vi.fn(() => vi.fn()),
    tryLeaveRoom: vi.fn(),
  },
}));

const createLifecycleHarness = (overrides = {}) => {
  const state = {
    currentUser: { id: 'user-1' },
    messages: [],
    isInitialized: false,
    loading: false,
    error: '',
    connectionStatus: 'checking',
    ...overrides.state,
  };
  const refs = {
    socketRef: { current: overrides.socket ?? null },
    mountedRef: { current: true },
    initializingRef: { current: false },
    setupCompleteRef: { current: false },
    userRooms: { current: new Map() },
    processedMessageIds: { current: new Set() },
    messageProcessingRef: { current: false },
    initialLoadCompletedRef: { current: false },
    loadMoreTimeoutRef: { current: null },
    previousMessagesRef: { current: new Set() },
    messageLoadAttemptRef: { current: 0 },
    cleanupInProgressRef: { current: false },
    ...overrides.refs,
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
    ...overrides.actions,
  };
  const setConnected = vi.fn();
  const cleanup = overrides.cleanup ?? vi.fn();

  const hook = renderHook(() =>
    useChatRoomLifecycle({
      roomId: 'room-1',
      route: {
        onNavigate: vi.fn(),
        onReplace: vi.fn(),
        asPath: '/chat/room-1',
      },
      state,
      refs,
      actions,
      authUser: { id: 'user-1' },
      activeSocket: refs.socketRef.current,
      setConnected,
      cleanup,
      handleReactionUpdate: vi.fn(),
    })
  );

  return {
    ...hook,
    state,
    refs,
    actions,
    setConnected,
    cleanup,
  };
};

describe('useChatRoomLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketClient.subscribeConnectionEvents.mockReturnValue(vi.fn());
  });

  it('returns only the lifecycle view model consumed by useChatRoom', () => {
    const { result } = createLifecycleHarness();

    expect(result.current).toEqual({
      connectionStatus: 'checking',
      retryMessageLoad: expect.any(Function),
    });
  });

  it('routes socket connection events through reducer connection actions', async () => {
    const socket = { connected: true };
    const harness = createLifecycleHarness({ socket });

    await waitFor(() => {
      expect(socketClient.subscribeConnectionEvents).toHaveBeenCalledWith(
        socket,
        expect.any(Object),
      );
    });

    const handlers = socketClient.subscribeConnectionEvents.mock.calls[0][1];
    handlers.onConnect();
    handlers.onDisconnect();
    handlers.onReconnecting();
    handlers.onReconnect();
    // 최종 실패 판정은 재연결이 모두 소진된 뒤에만 내린다.
    handlers.onReconnectFailed();

    expect(harness.actions.connectionEstablished).toHaveBeenCalledTimes(2);
    expect(harness.actions.connectionLost).toHaveBeenCalledTimes(1);
    expect(harness.actions.connectionFailed).toHaveBeenCalledWith(
      '채팅 서버와의 연결이 끊어졌습니다.',
    );
    expect(harness.actions.connectionReconnecting).toHaveBeenCalledTimes(1);
    expect(harness.actions.connectionRecovered).toHaveBeenCalledTimes(1);
    expect(harness.actions.setError).not.toHaveBeenCalledWith(
      '채팅 서버와의 연결이 끊어졌습니다.',
    );
    expect(harness.setConnected).toHaveBeenCalledWith(true);
  });

  it('does not redispatch the same connected state after reducer state catches up', async () => {
    const socket = { connected: true };
    const harness = createLifecycleHarness({ socket });

    await waitFor(() => {
      expect(harness.actions.connectionEstablished).toHaveBeenCalledTimes(1);
    });

    harness.state.connectionStatus = 'connected';
    harness.rerender();

    expect(harness.actions.connectionEstablished).toHaveBeenCalledTimes(1);
  });

  it('does not leave the room when initialization state catches up during rerender', async () => {
    const socket = { connected: true };
    const harness = createLifecycleHarness({
      socket,
      state: {
        currentUser: null,
      },
    });

    harness.state.currentUser = { id: 'user-1' };
    harness.rerender();

    expect(harness.cleanup).not.toHaveBeenCalled();
    expect(socketClient.tryLeaveRoom).not.toHaveBeenCalled();
  });
});
