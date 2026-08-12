import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * 방 화면이 붙들고 있는 소켓과 그 연결 여부만 관리한다.
 *
 * 재연결은 socket.io 내장 재연결이 하고, 그 결과를 화면에 옮기는 일은
 * useChatRoomLifecycle 이 한다. 여기서 같은 일을 또 세지 않는다.
 */
export const useSocketHandling = () => {
  const [connected, setConnected] = useState(false);
  const [activeSocket, setActiveSocket] = useState(null);
  const socketRef = useRef(null);

  // 활성 소켓을 바꾸는 유일한 경로. ref 대입만으로는 교체가 렌더에 드러나지 않아
  // 연결 이벤트를 구독하는 쪽이 죽은 소켓을 계속 붙들 수 있다. 관찰 가능한 값으로
  // 함께 내보내 구독이 교체를 따라가게 한다.
  const attachSocket = useCallback((socket) => {
    socketRef.current = socket;
    setActiveSocket(socket);
  }, []);

  useEffect(() => {
    if (!activeSocket) return;

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    activeSocket.on('connect', handleConnect);
    activeSocket.on('disconnect', handleDisconnect);

    setConnected(activeSocket.connected);

    return () => {
      activeSocket.off('connect', handleConnect);
      activeSocket.off('disconnect', handleDisconnect);
    };
  }, [activeSocket]);

  return {
    connected,
    socketRef,
    activeSocket,
    attachSocket,
    setConnected,
  };
};

export default useSocketHandling;
