import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatRoom } from '../useChatRoom';

const socket = {
  connected: true,
  off: vi.fn(),
};
const socketRef = { current: socket };
const cleanupManual = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Tester' },
  }),
}));

vi.mock('@/lib/socket/socketClient', () => ({
  default: {
    tryLeaveRoom: vi.fn(),
  },
}));

vi.mock('../useSocketHandling', () => ({
  useSocketHandling: () => ({
    connected: true,
    socketRef,
    activeSocket: socketRef.current,
    attachSocket: vi.fn(),
    setConnected: vi.fn(),
  }),
}));

vi.mock('../useChatRoomLifecycle', () => ({
  useChatRoomLifecycle: () => ({
    connectionStatus: 'connected',
    retryMessageLoad: vi.fn(),
  }),
}));

vi.mock('../useMessageHandling', () => ({
  useMessageHandling: () => ({
    filePreview: null,
    uploading: false,
    uploadProgress: 0,
    uploadError: null,
    setFilePreview: vi.fn(),
    handleMessageSubmit: vi.fn(),
    handleLoadMore: vi.fn(),
    removeFilePreview: vi.fn(),
  }),
}));

vi.mock('../useReactionHandling', () => ({
  useReactionHandling: () => ({
    handleReactionAdd: vi.fn(),
    handleReactionRemove: vi.fn(),
    handleReactionUpdate: vi.fn(),
  }),
}));

vi.mock('../useFileHandling', () => ({
  useFileHandling: () => ({
    fileInputRef: { current: null },
    uploading: false,
    uploadProgress: 0,
    uploadError: null,
    handleFileUpload: vi.fn(),
    handleFileSelect: vi.fn(),
    handleFileDrop: vi.fn(),
    removeFilePreview: vi.fn(),
  }),
}));

vi.mock('../useChatRoomState', () => ({
  useChatRoomState: () => ({
    state: {
      room: { _id: 'room-1' },
      messages: [{ _id: 'message-1' }],
      currentUser: { id: 'user-1' },
      error: 'old error',
      loading: true,
      messageLoadError: null,
      hasMoreMessages: true,
      loadingMessages: true,
    },
    refs: {
      mountedRef: { current: true },
      cleanupInProgressRef: { current: false },
      userRooms: { current: new Map([['socket-1', 'room-1']]) },
      previousMessagesRef: { current: new Set(['message-0']) },
      messageProcessingRef: { current: true },
      processedMessageIds: { current: new Set(['message-1']) },
      loadMoreTimeoutRef: { current: null },
    },
    actions: {
      setMessages: vi.fn(),
      setError: vi.fn(),
      setLoading: vi.fn(),
      setLoadingMessages: vi.fn(),
      cleanupManual,
    },
  }),
}));

describe('useChatRoom cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socket.connected = true;
  });

  it('uses the reducer cleanup action for manual cleanup state reset', () => {
    const { result } = renderHook(() =>
      useChatRoom({
        roomId: 'room-1',
        onNavigate: vi.fn(),
        onReplace: vi.fn(),
        asPath: '/chat/room-1',
      })
    );

    act(() => {
      result.current.cleanup();
    });

    expect(cleanupManual).toHaveBeenCalledTimes(1);
  });
});
