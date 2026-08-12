import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  chatRoomReducer,
  createInitialChatRoomState,
  useChatRoomState,
} from '../useChatRoomState';

describe('chatRoomReducer', () => {
  it('moves through setup start, success, and failure transitions', () => {
    const initial = createInitialChatRoomState();

    expect(chatRoomReducer(initial, { type: 'room/setupStarted' })).toMatchObject({
      loading: true,
      error: null,
    });

    expect(
      chatRoomReducer(initial, {
        type: 'room/setupSucceeded',
        room: { _id: 'room-1', participants: [] },
      })
    ).toMatchObject({
      room: { _id: 'room-1', participants: [] },
      isInitialized: true,
      loading: false,
    });

    expect(
      chatRoomReducer(initial, {
        type: 'room/setupFailed',
        error: '채팅방 연결에 실패했습니다.',
      })
    ).toMatchObject({
      error: '채팅방 연결에 실패했습니다.',
      loading: false,
    });
  });

  it('handles cleanup, connection status, message loading, and current user transitions', () => {
    const state = {
      ...createInitialChatRoomState(),
      messages: [{ _id: 'message-1' }],
      error: 'old error',
      loading: true,
      loadingMessages: true,
      connectionStatus: 'connected',
      currentUser: null,
    };

    expect(chatRoomReducer(state, { type: 'room/cleanupManual' })).toMatchObject({
      messages: [],
      error: null,
      loading: false,
      loadingMessages: false,
    });

    expect(
      chatRoomReducer(state, {
        type: 'messages/loadingChanged',
        loadingMessages: false,
      })
    ).toMatchObject({
      loadingMessages: false,
    });

    expect(
      chatRoomReducer(state, {
        type: 'messages/hasMoreChanged',
        hasMoreMessages: false,
      })
    ).toMatchObject({
      hasMoreMessages: false,
    });

    expect(
      chatRoomReducer(state, {
        type: 'user/currentChanged',
        currentUser: { id: 'user-1' },
      })
    ).toMatchObject({
      currentUser: { id: 'user-1' },
    });
  });

  it('uses explicit reducer events instead of generic state mutation events', () => {
    const state = createInitialChatRoomState();

    expect(
      chatRoomReducer(state, {
        type: 'room/changed',
        room: { _id: 'room-1' },
      })
    ).toMatchObject({
      room: { _id: 'room-1' },
    });

    expect(
      chatRoomReducer(state, {
        type: 'messages/changed',
        messages: [{ _id: 'message-1' }],
      })
    ).toMatchObject({
      messages: [{ _id: 'message-1' }],
    });

    expect(
      chatRoomReducer(state, {
        type: 'error/changed',
        error: 'new error',
      })
    ).toMatchObject({
      error: 'new error',
    });

    expect(chatRoomReducer(state, {
      type: 'state/setValue',
      key: 'error',
      value: 'escape hatch',
    })).toBe(state);
    expect(chatRoomReducer(state, {
      type: 'state/patch',
      patch: { error: 'escape hatch' },
    })).toBe(state);
  });

  it('handles semantic connection lifecycle transitions', () => {
    const state = {
      ...createInitialChatRoomState(),
      error: 'old error',
      connectionStatus: 'checking',
    };

    expect(chatRoomReducer(state, { type: 'connection/established' })).toMatchObject({
      connectionStatus: 'connected',
    });

    expect(chatRoomReducer(state, { type: 'connection/lost' })).toMatchObject({
      connectionStatus: 'disconnected',
    });

    expect(
      chatRoomReducer(state, {
        type: 'connection/failed',
        error: '채팅 서버와의 연결이 끊어졌습니다.',
      })
    ).toMatchObject({
      connectionStatus: 'error',
      error: '채팅 서버와의 연결이 끊어졌습니다.',
    });

    expect(chatRoomReducer(state, { type: 'connection/reconnecting' })).toMatchObject({
      connectionStatus: 'connecting',
    });

    expect(chatRoomReducer(state, { type: 'connection/recovered' })).toMatchObject({
      connectionStatus: 'connected',
      error: '',
    });
  });
});

describe('useChatRoomState', () => {
  it('exposes state, refs, and actions for chat room composition', () => {
    const { result } = renderHook(() => useChatRoomState());

    expect(result.current.state).toMatchObject({
      room: null,
      messages: [],
      error: '',
      loading: true,
      connectionStatus: 'checking',
      hasMoreMessages: true,
      loadingMessages: false,
    });
    expect(result.current.refs.mountedRef.current).toBe(true);
    expect(result.current.refs.userRooms.current).toBeInstanceOf(Map);

    act(() => {
      result.current.actions.setCurrentUser({ id: 'user-1' });
      result.current.actions.connectionRecovered();
      result.current.actions.setRoom({ _id: 'room-1' });
      result.current.actions.setMessages([{ _id: 'message-1' }]);
      result.current.actions.setError('room error');
    });

    expect(result.current.state).toMatchObject({
      currentUser: { id: 'user-1' },
      connectionStatus: 'connected',
      room: { _id: 'room-1' },
      messages: [{ _id: 'message-1' }],
      error: 'room error',
    });
    expect(result.current.actions.dispatch).toBeUndefined();
    expect(result.current.actions.setLoading).toBeUndefined();
    expect(result.current.actions.setIsInitialized).toBeUndefined();
    expect(result.current.actions.setConnectionStatus).toBeUndefined();
    expect(result.current.actions.setMessageLoadError).toBeUndefined();
  });
});
