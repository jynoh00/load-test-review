import { useContext } from 'react';
import { SocketContext } from './SocketProvider';

export const useSocket = () => {
  const client = useContext(SocketContext);

  if (!client) {
    throw new Error('useSocket must be used within SocketProvider');
  }

  return client;
};
