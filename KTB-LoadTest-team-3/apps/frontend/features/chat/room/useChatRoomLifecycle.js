import { useCallback, useEffect, useRef } from 'react';
import socketClient from '@/lib/socket/socketClient';
import { useRoomHandling } from './useRoomHandling';

const CLEANUP_REASONS = {
  UNMOUNT: 'unmount',
};

export const useChatRoomLifecycle = ({
  roomId,
  route,
  state,
  refs,
  actions,
  authUser,
  activeSocket,
  setConnected,
  cleanup,
  handleReactionUpdate,
}) => {
  const {
    onReplace,
    asPath,
  } = route;
  const {
    currentUser,
    isInitialized,
    connectionStatus,
  } = state;
  const {
    socketRef,
    mountedRef,
    initializingRef,
    setupCompleteRef,
    cleanupInProgressRef,
    previousMessagesRef,
    processedMessageIds,
    initialLoadCompletedRef,
    loadMoreTimeoutRef,
    messageLoadAttemptRef,
  } = refs;
  const {
    setCurrentUser,
    setError,
    connectionEstablished,
    connectionLost,
    connectionFailed,
    connectionReconnecting,
    connectionRecovered,
  } = actions;

  const {
    setupRoom,
    rejoinRoom,
    loadInitialMessages,
  } = useRoomHandling({
    roomId,
    route,
    state,
    refs,
    actions,
    cleanup,
    handleReactionUpdate,
  });

  const cleanupRef = useRef(cleanup);

  useEffect(() => {
    cleanupRef.current = cleanup;
  }, [cleanup]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }

      if (socketRef.current?.connected && roomId && !cleanupInProgressRef.current) {
        cleanupRef.current(CLEANUP_REASONS.UNMOUNT);
      }
    };
  }, [
    roomId,
    socketRef,
    mountedRef,
    cleanupInProgressRef,
    loadMoreTimeoutRef,
  ]);

  // 구독은 ref 가 아니라 활성 소켓 자체에 묶는다. ref 는 교체돼도 렌더를 유발하지
  // 않아, 소켓이 갈리면 죽은 소켓에 붙은 채로 끊김을 놓친다.
  useEffect(() => {
    if (!activeSocket || !currentUser) return;

    const handleConnect = () => {
      if (!mountedRef.current) return;
      connectionEstablished();
      setConnected(true);

      if (!roomId || setupCompleteRef.current || initializingRef.current) return;

      // 최초 진입이면 방 데이터·구독·입장을 모두 세운다.
      if (!isInitialized) {
        setupRoom().catch(() => {
          setError('채팅방 연결에 실패했습니다.');
        });
        return;
      }

      // 재연결이면 소켓은 socket.io 가 이미 되살렸다. 방에만 다시 들어간다.
      rejoinRoom().catch(() => {
        setError('채팅방 재연결에 실패했습니다.');
      });
    };

    const handleDisconnect = () => {
      if (!mountedRef.current) return;
      connectionLost();
      setupCompleteRef.current = false;
    };

    // socket.io 는 재연결을 시도할 때마다 connect_error 를 낸다.
    // 시도가 남아 있는 동안의 실패를 최종 실패로 처리하면, 끊긴 지 1초 만에
    // 재연결 안내 대신 실패 화면이 뜬다. 최종 판정은 reconnect_failed 에서 한다.
    const handleReconnectFailed = () => {
      if (!mountedRef.current) return;
      connectionFailed('채팅 서버와의 연결이 끊어졌습니다.');
    };

    const handleReconnecting = () => {
      if (!mountedRef.current) return;
      connectionReconnecting();
    };

    // manager 'reconnect' 는 engine open 직후 — 서버의 CONNECT 응답 전 — 발생하므로
    // 이 시점 socket.connected 는 아직 false 다. 방 재입장을 여기서 하면 살아 있는
    // 소켓을 버리고 새로 만들게 되니, 화면 상태만 되돌리고 재입장은 'connect' 에 맡긴다.
    const handleReconnectSuccess = () => {
      if (!mountedRef.current) return;
      connectionRecovered();
      setConnected(true);
    };

    const unsubscribeConnectionEvents = socketClient.subscribeConnectionEvents(activeSocket, {
      onConnect: handleConnect,
      onDisconnect: handleDisconnect,
      onReconnecting: handleReconnecting,
      onReconnect: handleReconnectSuccess,
      onReconnectFailed: handleReconnectFailed,
    });

    if (activeSocket.connected && connectionStatus !== 'connected') {
      connectionEstablished();
    } else if (!activeSocket.connected && connectionStatus !== 'disconnected') {
      connectionLost();
    }

    return () => {
      unsubscribeConnectionEvents();
    };
  }, [
    roomId,
    activeSocket,
    setupRoom,
    rejoinRoom,
    setConnected,
    currentUser,
    isInitialized,
    connectionStatus,
    setError,
    connectionEstablished,
    connectionLost,
    connectionFailed,
    connectionReconnecting,
    connectionRecovered,
    socketRef,
    mountedRef,
    initializingRef,
    setupCompleteRef,
  ]);

  useEffect(() => {
    const initializeChat = async () => {
      if (initializingRef.current) return;

      if (!authUser) {
        onReplace('/?redirect=' + asPath);
        return;
      }

      if (!currentUser) {
        setCurrentUser(authUser);
      }

      if (!isInitialized && roomId) {
        try {
          initializingRef.current = true;
          await setupRoom();
        } catch (error) {
          setError('채팅방 초기화에 실패했습니다.');
        } finally {
          initializingRef.current = false;
        }
      }
    };

    if (roomId) {
      initializeChat();
    }
  }, [
    roomId,
    setupRoom,
    isInitialized,
    setError,
    authUser,
    currentUser,
    setCurrentUser,
    onReplace,
    asPath,
    initializingRef,
  ]);

  useEffect(() => {
    const tokenCheckInterval = setInterval(() => {
      if (!mountedRef.current) return;

      if (!authUser) {
        clearInterval(tokenCheckInterval);
        onReplace('/?redirect=' + asPath);
      }
    }, 60000);

    return () => {
      clearInterval(tokenCheckInterval);
    };
  }, [
    authUser,
    onReplace,
    asPath,
    mountedRef,
  ]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socketRef.current?.connected && roomId) {
        socketClient.tryLeaveRoom(roomId, socketRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomId, socketRef]);

  const retryMessageLoad = useCallback(() => {
    if (mountedRef.current) {
      messageLoadAttemptRef.current = 0;
      previousMessagesRef.current.clear();
      processedMessageIds.current.clear();
      initialLoadCompletedRef.current = false;
      loadInitialMessages(roomId);
    }
  }, [
    loadInitialMessages,
    roomId,
    mountedRef,
    messageLoadAttemptRef,
    previousMessagesRef,
    processedMessageIds,
    initialLoadCompletedRef,
  ]);

  return {
    connectionStatus,
    retryMessageLoad,
  };
};

export default useChatRoomLifecycle;
