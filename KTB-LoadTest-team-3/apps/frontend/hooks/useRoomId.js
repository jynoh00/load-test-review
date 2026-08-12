import { useParams } from 'next/navigation';

export const useRoomId = () => {
  return useParams()?.room;
};

export default useRoomId;
