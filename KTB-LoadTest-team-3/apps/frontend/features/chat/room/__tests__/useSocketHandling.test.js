import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSocketHandling } from '../useSocketHandling';

vi.mock('@/lib/socket/socketClient', () => ({
  default: {
    connect: vi.fn(),
    joinRoom: vi.fn(),
  },
}));

vi.mock('@/components/Toast', () => ({
  Toast: { error: vi.fn() },
}));

describe('useSocketHandling', () => {
  // ref 대입만으로는 소켓 교체가 렌더에 드러나지 않아, 연결 이벤트를 구독하는 쪽이
  // 죽은 소켓을 계속 붙들 수 있다. 교체를 관찰 가능한 값으로 함께 내보낸다.
  it('attachSocket 은 교체된 소켓을 렌더에 노출한다', () => {
    const { result } = renderHook(() => useSocketHandling('room-1'));
    const socket = { id: 'socket-A', connected: true, on: vi.fn(), off: vi.fn() };

    expect(result.current.activeSocket).toBeNull();

    act(() => {
      result.current.attachSocket(socket);
    });

    expect(result.current.socketRef.current).toBe(socket);
    expect(result.current.activeSocket).toBe(socket);
  });

  it('attachSocket(null) 은 소켓이 사라진 것도 알린다', () => {
    const { result } = renderHook(() => useSocketHandling('room-1'));

    act(() => {
      result.current.attachSocket({ id: 'socket-A', connected: true, on: vi.fn(), off: vi.fn() });
    });
    act(() => {
      result.current.attachSocket(null);
    });

    expect(result.current.socketRef.current).toBeNull();
    expect(result.current.activeSocket).toBeNull();
  });
});
