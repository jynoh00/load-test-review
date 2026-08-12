import React from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SocketProvider } from '../SocketProvider';

const renderProvider = (client, session = null) =>
  render(
    <SocketProvider client={client} session={session}>
      <div>child</div>
    </SocketProvider>
  );

describe('SocketProvider', () => {
  it('does not reconnect online without an authenticated session', () => {
    const client = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => false),
    };

    renderProvider(client);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(client.connect).not.toHaveBeenCalled();
  });

  it('reconnects online with auth when a session exists', () => {
    const client = {
      connect: vi.fn().mockResolvedValue({ id: 'socket-1' }),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => false),
    };

    renderProvider(client, {
      token: 'token-1',
      sessionId: 'session-1',
    });

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(client.connect).toHaveBeenCalledWith({
      auth: {
        token: 'token-1',
        sessionId: 'session-1',
      },
    });
  });
});
