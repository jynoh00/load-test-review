import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MessageActions from '../MessageActions';
import { Toast } from '../Toast';

vi.mock('../EmojiPicker', () => ({
  default: ({ onSelect }) => (
    <button type="button" onClick={() => onSelect('👍')}>
      👍
    </button>
  ),
}));

vi.mock('../Toast', () => ({
  Toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('MessageActions', () => {
  afterEach(() => {
    cleanup();
    Toast.success.mockClear();
    Toast.error.mockClear();
    Toast.info.mockClear();
    document.getElementById('message-copy-fallback')?.remove();
    delete document.execCommand;
  });

  it('copies a message even when navigator.clipboard is unavailable', async () => {
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn((command) => command === 'copy'),
    });

    render(<MessageActions messageContent="복사할 메시지" />);

    fireEvent.click(screen.getByLabelText('메시지 복사'));

    await waitFor(() => {
      expect(Toast.success).toHaveBeenCalledWith('메시지가 클립보드에 복사되었습니다.');
    });
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(Toast.error).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  });

  it('selects the message when the browser has no copy API', async () => {
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    render(<MessageActions messageContent="직접 복사할 메시지" />);

    fireEvent.click(screen.getByLabelText('메시지 복사'));

    await waitFor(() => {
      expect(Toast.info).toHaveBeenCalledWith(
        '브라우저가 자동 복사를 지원하지 않아 메시지를 선택했습니다. Cmd+C로 복사해주세요.'
      );
    });
    expect(document.getElementById('message-copy-fallback')).toHaveValue('직접 복사할 메시지');
    expect(Toast.error).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  });
});
