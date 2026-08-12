import socketService from '../../services/socket';

const sendDomainEvent = (service, socket, event, data) => {
  if (socket) {
    return service.sendOn(socket, event, data);
  }

  return service.send(event, data);
};

const ensureConnectedSocket = (socket) => {
  if (!socket?.connected) {
    throw new Error('Socket not connected');
  }
};

const createTimeoutError = (message) => new Error(message);

const waitForSocketEvent = ({
  socket,
  successEvent,
  errorEvents,
  timeoutMs,
  timeoutMessage,
  send,
}) => {
  ensureConnectedSocket(socket);

  return new Promise((resolve, reject) => {
    let timeoutId;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      socket.off(successEvent, handleSuccess);
      for (const event of errorEvents) {
        socket.off(event, handleError);
      }
    };

    const settle = (callback, value) => {
      cleanup();
      callback(value);
    };

    const handleSuccess = (data) => settle(resolve, data);
    const handleError = (error) => settle(reject, error);

    socket.once(successEvent, handleSuccess);
    for (const event of errorEvents) {
      socket.once(event, handleError);
    }

    timeoutId = setTimeout(() => {
      settle(reject, createTimeoutError(timeoutMessage));
    }, timeoutMs);

    try {
      send();
    } catch (error) {
      settle(reject, error);
    }
  });
};

const roomEventMap = {
  participantsUpdate: 'onParticipantsUpdate',
  messagesRead: 'onMessagesRead',
  message: 'onMessage',
  previousMessagesLoaded: 'onPreviousMessagesLoaded',
  messageReactionUpdate: 'onMessageReactionUpdate',
  session_ended: 'onSessionEnded',
  error: 'onError',
};

const connectionEventMap = {
  connect: 'onConnect',
  disconnect: 'onDisconnect',
  connect_error: 'onConnectError',
};

/**
 * socket.io v4 에서 재연결 이벤트는 socket 이 아니라 manager(socket.io)에서 발생한다.
 * socket 에 붙이면 영원히 호출되지 않아 재연결 성공도 최종 실패도 감지하지 못한다.
 */
const managerEventMap = {
  reconnect_attempt: 'onReconnecting',
  reconnect: 'onReconnect',
  reconnect_failed: 'onReconnectFailed',
};

const subscribeMappedEvents = (emitter, handlers, eventMap) => {
  if (!emitter) {
    return () => {};
  }

  const subscriptions = Object.entries(eventMap)
    .map(([event, handlerName]) => [event, handlers[handlerName]])
    .filter(([, handler]) => typeof handler === 'function');

  for (const [event, handler] of subscriptions) {
    emitter.on(event, handler);
  }

  return () => {
    for (const [event, handler] of subscriptions) {
      emitter.off(event, handler);
    }
  };
};

export const createSocketClient = (service = socketService) => ({
  connect: (options) => service.connect(options),
  disconnect: () => service.disconnect(),
  isConnected: () => service.isConnected(),
  canSend: () => service.isConnected(),
  send: (event, data) => service.send(event, data),
  sendChatMessage: (payload, socket) => sendDomainEvent(service, socket, 'chatMessage', payload),
  sendChatMessageAndWait: (payload, socket, { timeoutMs = 8000 } = {}) =>
    waitForSocketEvent({
      socket,
      successEvent: 'message',
      errorEvents: ['error'],
      timeoutMs,
      timeoutMessage: '메시지 전송이 지연되고 있습니다. 다시 시도해주세요.',
      send: () => sendDomainEvent(service, socket, 'chatMessage', payload),
    }),
  fetchPreviousMessages: (payload, socket) => sendDomainEvent(service, socket, 'fetchPreviousMessages', payload),
  fetchPreviousMessagesAndWait: (payload, socket, { timeoutMs = 10000 } = {}) =>
    waitForSocketEvent({
      socket,
      successEvent: 'previousMessagesLoaded',
      errorEvents: ['error'],
      timeoutMs,
      timeoutMessage: '메시지 로딩 시간이 초과되었습니다.',
      send: () => sendDomainEvent(service, socket, 'fetchPreviousMessages', payload),
    }),
  joinRoom: (roomId, socket) => sendDomainEvent(service, socket, 'joinRoom', roomId),
  joinRoomAndWait: (roomId, socket, { timeoutMs = 10000 } = {}) =>
    waitForSocketEvent({
      socket,
      successEvent: 'joinRoomSuccess',
      errorEvents: ['joinRoomError', 'error'],
      timeoutMs,
      timeoutMessage: '채팅방 입장 시간이 초과되었습니다.',
      send: () => sendDomainEvent(service, socket, 'joinRoom', roomId),
    }),
  leaveRoom: (roomId, socket) => sendDomainEvent(service, socket, 'leaveRoom', roomId),
  tryLeaveRoom: (roomId, socket) => service.trySendOn(socket, 'leaveRoom', roomId),
  markMessagesAsRead: (messageIds, socket) => {
    if (!Array.isArray(messageIds)) {
      throw new Error('messageIds must be an array');
    }

    return sendDomainEvent(service, socket, 'markMessagesAsRead', { messageIds });
  },
  sendMessageReaction: (messageId, reaction, type, socket) => sendDomainEvent(service, socket, 'messageReaction', {
    messageId,
    reaction,
    type,
  }),
  subscribeRoomEvents: (socket, handlers) => subscribeMappedEvents(socket, handlers, roomEventMap),
  subscribeConnectionEvents: (socket, handlers) => {
    const unsubscribeSocket = subscribeMappedEvents(socket, handlers, connectionEventMap);
    const unsubscribeManager = subscribeMappedEvents(socket?.io, handlers, managerEventMap);

    return () => {
      unsubscribeSocket();
      unsubscribeManager();
    };
  },
});

const socketClient = createSocketClient();

export default socketClient;
