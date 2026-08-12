import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFileHandling } from './useFileHandling';
import { useMessageHandling } from './useMessageHandling';
import { useReactionHandling } from './useReactionHandling';
import { useSocketHandling } from './useSocketHandling';
import { useChatRoomState } from './useChatRoomState';
import { useChatRoomLifecycle } from './useChatRoomLifecycle';
import socketClient from '@/lib/socket/socketClient';

export const useChatRoom = ({ roomId, onNavigate, onReplace, asPath }) => {
  const { user: authUser } = useAuth();
  const {
    state,
    refs,
    actions,
  } = useChatRoomState();

  const {
    room,
    messages,
    currentUser,
    error,
    loading,
    messageLoadError,
    hasMoreMessages,
    loadingMessages,
  } = state;

  const {
    mountedRef,
    cleanupInProgressRef,
    userRooms,
    previousMessagesRef,
    messageProcessingRef,
    processedMessageIds,
    loadMoreTimeoutRef,
  } = refs;

  const {
    setMessages,
    setError,
    setLoadingMessages,
    cleanupManual,
  } = actions;

  // Socket handling setup
  const {
    connected,
    socketRef,
    activeSocket,
    attachSocket,
    setConnected
  } = useSocketHandling();
  const roomRefs = {
    ...refs,
    socketRef,
    attachSocket,
  };

  // Message handling hook
  const {
    filePreview,
    uploading,
    uploadProgress,
    uploadError,
    handleMessageSubmit,
    handleLoadMore,
    removeFilePreview,
  } = useMessageHandling(currentUser, roomId, undefined, messages, loadingMessages, setLoadingMessages, socketRef);

  // Cleanup 함수 수정
  const cleanup = useCallback((reason = 'MANUAL') => {
    if (!mountedRef.current || !roomId) return;

    try {
      // cleanup이 이미 진행 중인지 확인
      if (cleanupInProgressRef.current) {
        return;
      }

      cleanupInProgressRef.current = true;

      // Socket cleanup
      if (roomId && socketRef.current?.connected) {
        socketClient.tryLeaveRoom(roomId, socketRef.current);
      }

      if (socketRef.current && reason !== 'RECONNECT') {
        socketRef.current.off('message');
        socketRef.current.off('previousMessagesLoaded');
        socketRef.current.off('participantsUpdate');
        socketRef.current.off('messagesRead');
        socketRef.current.off('messageReactionUpdate');
        socketRef.current.off('session_ended');
        socketRef.current.off('error');
      }

      // Clear timeouts
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
        loadMoreTimeoutRef.current = null;
      }

      // Reset refs
      processedMessageIds.current.clear();
      previousMessagesRef.current.clear();
      messageProcessingRef.current = false;

      // Reset states only if needed
      if (reason === 'MANUAL' && mountedRef.current) {
        cleanupManual();

        if (userRooms.current.size > 0) {
          userRooms.current.clear();
        }
      } else if (reason === 'DISCONNECT' && mountedRef.current) {
        setError('채팅 연결이 끊어졌습니다. 재연결을 시도합니다.');
      }

    } catch (error) {
      if (mountedRef.current) {
        setError('채팅방 정리 중 오류가 발생했습니다.');
      }
    } finally {
      cleanupInProgressRef.current = false;
    }
  }, [
    setError,
    cleanupManual,
    mountedRef,
    roomId,
    cleanupInProgressRef,
    socketRef,
    loadMoreTimeoutRef,
    processedMessageIds,
    previousMessagesRef,
    messageProcessingRef,
    userRooms,
  ]);

  // Reaction handling hook
  const {
    handleReactionAdd,
    handleReactionRemove,
    handleReactionUpdate,
  } = useReactionHandling({ currentUser, messages, setMessages });

  const {
    connectionStatus: derivedConnectionStatus,
    retryMessageLoad,
  } = useChatRoomLifecycle({
    roomId,
    route: { onNavigate, onReplace, asPath },
    state,
    refs: roomRefs,
    actions,
    authUser,
    activeSocket,
    setConnected,
    cleanup,
    handleReactionUpdate,
  });

  // File handling hook
  const { fileInputRef } = useFileHandling(currentUser, roomId);

  return {
    // State
    room,
    messages,
    error,
    loading,
    connected,
    currentUser,
    filePreview,
    uploading,
    uploadProgress,
    uploadError,
    hasMoreMessages,
    loadingMessages,

    // Refs
    fileInputRef,
    socketRef,

    // Handlers
    handleMessageSubmit,
    removeFilePreview,
    handleReactionAdd,
    handleReactionRemove,
    handleLoadMore,
    cleanup,

    // Setters
    setError,

    // Status
    connectionStatus: derivedConnectionStatus,
    messageLoadError,

    // Retry handler
    retryMessageLoad,
  };
};

export default useChatRoom;
