import { useMemo, useReducer, useRef } from 'react';

export const createInitialChatRoomState = () => ({
  room: null,
  messages: [],
  currentUser: null,
  error: '',
  loading: true,
  connectionStatus: 'checking',
  messageLoadError: null,
  isInitialized: false,
  hasMoreMessages: true,
  loadingMessages: false,
});

const resolveValue = (value, currentValue) => (
  typeof value === 'function' ? value(currentValue) : value
);

export const chatRoomReducer = (state, action) => {
  switch (action.type) {
    case 'room/setupStarted':
      return {
        ...state,
        loading: true,
        error: null,
      };
    case 'room/setupSucceeded':
      return {
        ...state,
        room: action.room,
        isInitialized: true,
        loading: false,
      };
    case 'room/setupFailed':
      return {
        ...state,
        error: action.error,
        loading: false,
      };
    case 'room/cleanupManual':
      return {
        ...state,
        error: null,
        loading: false,
        loadingMessages: false,
        messages: [],
      };
    case 'room/changed':
      return {
        ...state,
        room: resolveValue(action.room, state.room),
      };
    case 'messages/changed':
      return {
        ...state,
        messages: resolveValue(action.messages, state.messages),
      };
    case 'error/changed':
      return {
        ...state,
        error: resolveValue(action.error, state.error),
      };
    case 'connection/established':
      return {
        ...state,
        connectionStatus: 'connected',
      };
    case 'connection/lost':
      return {
        ...state,
        connectionStatus: 'disconnected',
      };
    case 'connection/failed':
      return {
        ...state,
        connectionStatus: 'error',
        error: action.error,
      };
    case 'connection/reconnecting':
      return {
        ...state,
        connectionStatus: 'connecting',
      };
    case 'connection/recovered':
      return {
        ...state,
        connectionStatus: 'connected',
        error: '',
      };
    case 'messages/loadingChanged':
      return {
        ...state,
        loadingMessages: action.loadingMessages,
      };
    case 'messages/hasMoreChanged':
      return {
        ...state,
        hasMoreMessages: action.hasMoreMessages,
      };
    case 'user/currentChanged':
      return {
        ...state,
        currentUser: action.currentUser,
      };
    default:
      return state;
  }
};

export const useChatRoomState = () => {
  const [state, dispatch] = useReducer(
    chatRoomReducer,
    undefined,
    createInitialChatRoomState,
  );

  const refs = {
    messageLoadAttemptRef: useRef(0),
    mountedRef: useRef(true),
    initializingRef: useRef(false),
    setupCompleteRef: useRef(false),
    cleanupInProgressRef: useRef(false),
    userRooms: useRef(new Map()),
    previousMessagesRef: useRef(new Set()),
    messageProcessingRef: useRef(false),
    initialLoadCompletedRef: useRef(false),
    processedMessageIds: useRef(new Set()),
    loadMoreTimeoutRef: useRef(null),
  };

  const actions = useMemo(() => ({
    setupStarted: () => dispatch({ type: 'room/setupStarted' }),
    setupSucceeded: room => dispatch({ type: 'room/setupSucceeded', room }),
    setupFailed: error => dispatch({ type: 'room/setupFailed', error }),
    cleanupManual: () => dispatch({ type: 'room/cleanupManual' }),
    setRoom: room => dispatch({ type: 'room/changed', room }),
    setMessages: messages => dispatch({ type: 'messages/changed', messages }),
    setError: error => dispatch({ type: 'error/changed', error }),
    setLoadingMessages: value => dispatch({
      type: 'messages/loadingChanged',
      loadingMessages: value,
    }),
    setHasMoreMessages: value => dispatch({
      type: 'messages/hasMoreChanged',
      hasMoreMessages: value,
    }),
    connectionEstablished: () => dispatch({ type: 'connection/established' }),
    connectionLost: () => dispatch({ type: 'connection/lost' }),
    connectionFailed: error => dispatch({ type: 'connection/failed', error }),
    connectionReconnecting: () => dispatch({ type: 'connection/reconnecting' }),
    connectionRecovered: () => dispatch({ type: 'connection/recovered' }),
    setCurrentUser: currentUser => dispatch({ type: 'user/currentChanged', currentUser }),
  }), []);

  return {
    state,
    refs,
    actions,
  };
};

export default useChatRoomState;
