import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import socketClient from '@/lib/socket/socketClient';
import { useChatRoom } from '../useChatRoom';

const socket = {
  connected: true,
  on: vi.fn(),
  off: vi.fn(),
};
const socketRef = { current: socket };
const setupRoom = vi.fn(() => Promise.resolve());
const setConnected = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Tester' },
    logout: vi.fn(),
  }),
}));

vi.mock('@/lib/socket/socketClient', () => ({
  default: {
    subscribeConnectionEvents: vi.fn(() => vi.fn()),
    tryLeaveRoom: vi.fn(),
  },
}));

vi.mock('../useSocketHandling', () => ({
  useSocketHandling: () => ({
    connected: true,
    socketRef,
    activeSocket: socketRef.current,
    attachSocket: vi.fn(),
    setConnected,
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

vi.mock('../useRoomHandling', () => ({
  useRoomHandling: () => ({
    setupRoom,
    rejoinRoom: vi.fn(() => Promise.resolve()),
    loadInitialMessages: vi.fn(),
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

describe('useChatRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socket.connected = true;
    socketClient.subscribeConnectionEvents.mockReturnValue(vi.fn());
  });

  it('subscribes connection monitoring through socketClient', async () => {
    renderHook(() =>
      useChatRoom({
        roomId: 'room-1',
        onNavigate: vi.fn(),
        onReplace: vi.fn(),
        asPath: '/chat/room-1',
      })
    );

    await waitFor(() => {
      expect(socketClient.subscribeConnectionEvents).toHaveBeenCalledWith(
        socket,
        expect.objectContaining({
          onConnect: expect.any(Function),
          onDisconnect: expect.any(Function),
          onReconnecting: expect.any(Function),
          onReconnect: expect.any(Function),
          onReconnectFailed: expect.any(Function),
        }),
      );
    });
    expect(socket.on).not.toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('keeps the view model fields consumed by ChatRoomView', () => {
    const { result } = renderHook(() =>
      useChatRoom({
        roomId: 'room-1',
        onNavigate: vi.fn(),
        onReplace: vi.fn(),
        asPath: '/chat/room-1',
      })
    );

    expect('room' in result.current).toBe(true);
    expect('currentUser' in result.current).toBe(true);
    expect(result.current).toEqual(
      expect.objectContaining({
        messages: expect.any(Array),
        loading: expect.any(Boolean),
        connected: expect.any(Boolean),
        connectionStatus: expect.any(String),
        fileInputRef: expect.any(Object),
        handleMessageSubmit: expect.any(Function),
        handleReactionAdd: expect.any(Function),
        handleReactionRemove: expect.any(Function),
        handleLoadMore: expect.any(Function),
        retryMessageLoad: expect.any(Function),
      })
    );
  });
});
