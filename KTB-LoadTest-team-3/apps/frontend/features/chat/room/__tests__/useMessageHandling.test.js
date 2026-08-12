import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Toast } from '@/components/Toast';
import socketClient from '@/lib/socket/socketClient';
import fileService from '@/services/fileService';
import { useMessageHandling } from '../useMessageHandling';

vi.mock('@/components/Toast', () => ({
  Toast: {
    error: vi.fn(),
  },
  default: () => null,
}));

vi.mock('@/services/fileService', () => ({
  default: {
    uploadFile: vi.fn(),
  },
}));

vi.mock('@/lib/socket/socketClient', () => ({
  default: {
    canSend: vi.fn(() => true),
    sendChatMessageAndWait: vi.fn(),
    fetchPreviousMessages: vi.fn(),
  },
}));

const roomId = 'room-1';

const currentUser = {
  token: 'token-1',
  sessionId: 'session-1',
};

describe('useMessageHandling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketClient.canSend.mockReturnValue(true);
  });

  it('sends trimmed text message through the subscribed room socket', async () => {
    const roomSocket = { connected: true };
    const socketRef = { current: roomSocket };
    const { result } = renderHook(() =>
      useMessageHandling(currentUser, roomId, vi.fn(), [], false, vi.fn(), socketRef)
    );

    await act(async () => {
      await result.current.handleMessageSubmit({ content: '  hello  ' });
    });

    expect(socketClient.sendChatMessageAndWait).toHaveBeenCalledWith(
      {
        room: 'room-1',
        type: 'text',
        content: 'hello',
      },
      roomSocket,
    );
  });

  it('shows a connection error without emitting when disconnected', async () => {
    socketClient.canSend.mockReturnValue(false);
    const { result } = renderHook(() =>
      useMessageHandling(currentUser, roomId, vi.fn())
    );

    await act(async () => {
      await result.current.handleMessageSubmit({ content: 'hello' });
    });

    expect(socketClient.sendChatMessageAndWait).not.toHaveBeenCalled();
    expect(Toast.error).toHaveBeenCalledWith('채팅 서버와 연결이 끊어졌습니다.');
  });

  it('uploads files, sends file messages, and clears file preview state', async () => {
    const roomSocket = { connected: true };
    const socketRef = { current: roomSocket };
    fileService.uploadFile.mockResolvedValue({
      success: true,
      data: {
        file: {
          _id: 'file-1',
          filename: 'stored.pdf',
          originalname: 'sample.pdf',
          mimetype: 'application/pdf',
          size: 128,
        },
      },
    });
    const { result } = renderHook(() =>
      useMessageHandling(currentUser, roomId, vi.fn(), [], false, vi.fn(), socketRef)
    );

    await act(async () => {
      result.current.setFilePreview({ name: 'sample.pdf' });
      await result.current.handleMessageSubmit({
        type: 'file',
        content: 'attached',
        fileData: {
          file: { name: 'sample.pdf' },
        },
      });
    });

    expect(socketClient.sendChatMessageAndWait).toHaveBeenCalledWith(
      {
        room: 'room-1',
        type: 'file',
        content: 'attached',
        fileData: {
          _id: 'file-1',
          filename: 'stored.pdf',
          originalname: 'sample.pdf',
          mimetype: 'application/pdf',
          size: 128,
        },
      },
      roomSocket,
    );
    expect(result.current.filePreview).toBeNull();
    expect(result.current.uploadError).toBeNull();
  });
});
