import React from 'react';
import { GroupOutlineIcon } from '@vapor-ui/icons';
import { HStack, VStack, Text, Badge, Collapsible } from '@vapor-ui/core';
import CustomAvatar from './CustomAvatar';

const ChatRoomInfo = ({ room, connectionStatus }) => {
  const getParticipantKey = (participant, index) => {
    return participant?._id || participant?.id || participant?.email || `${participant?.name || 'participant'}-${index}`;
  };

  const getConnectionStatus = () => {
    if (connectionStatus === 'connected') {
      return {
        label: "연결됨",
        color: "success"
      };
    }

    // 재연결이 아직 남아 있는 동안은 복구 가능한 상태다.
    // 화면을 오류로 덮지 않고 배지로만 알린다.
    if (connectionStatus === 'connecting' || connectionStatus === 'disconnected') {
      return {
        label: "재접속 중...",
        color: "warning"
      };
    }

    return {
      label: "연결 끊김",
      color: "danger"
    };
  };

  const status = getConnectionStatus();
  const participants = room?.participants || [];
  const maxVisibleAvatars = 3;
  const remainingCount = Math.max(0, participants.length - maxVisibleAvatars);

  return (
    <Collapsible.Root>
      <HStack
        className="bg-surface-200 relative"
        $css={{
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          paddingInline: '$400',
          paddingBlock: '$100',
        }}
      >
        {/* 왼쪽: 참여자 아바타 + 인원수 */}
        <Collapsible.Trigger
          render={
            <button className="bg-transparent border-none cursor-pointer flex items-center gap-2 hover:bg-background-contrast-100 rounded-lg px-2 py-1 -ml-2 transition-colors group">
              <HStack $css={{ gap: '$100', alignItems: 'center' }}>
                {/* 아바타 겹치기 스타일 */}
                <div className="flex -space-x-2">
                  {participants.slice(0, maxVisibleAvatars).map((participant, index) => (
                    <div
                      key={getParticipantKey(participant, index)}
                      className="ring-1 rounded-full"
                      style={{ zIndex: maxVisibleAvatars - index }}
                    >
                      <CustomAvatar
                        user={participant}
                        size="sm"
                        showInitials
                      />
                    </div>
                  ))}
                  {remainingCount > 0 && (
                    <div
                      className="ring-1 rounded-full z-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-background-contrast-200 flex items-center justify-center">
                        <span className="text-xs font-medium text-foreground-hint-100">
                          +{remainingCount}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <HStack className="ml-1" $css={{ gap: '$050', alignItems: 'center' }}>
                  <GroupOutlineIcon  className="text-foreground-hint-100 group-hover:text-foreground-normal-100" />
                  <Text
                    typography="body2"
                    className="text-foreground-hint-100 group-hover:text-foreground-normal-100 font-medium"
                  >
                    {participants.length}명
                  </Text>
                </HStack>
              </HStack>
            </button>
          }
        />

        {/* 중앙: 채팅방 제목 */}
        <Text
          typography="heading4"
          className="font-semibold text-foreground-normal-200 absolute left-1/2 transform -translate-x-1/2"
        >
          {room?.name || '채팅방'}
        </Text>

        {/* 오른쪽: 연결 상태 */}
        <Badge
          colorPalette={status.color}
          size="sm"
        >
          {status.label}
        </Badge>
      </HStack>

      {/* 참여자 목록 패널 */}
      <Collapsible.Panel>
        <div className="bg-surface-200 border-b border-border-secondary">
          <VStack $css={{ gap: '$100', padding: '$300' }}>
            <Text typography="subtitle2" className="text-foreground-normal-100 px-2">
              참여자 목록
            </Text>
            <div className="max-h-64 overflow-y-auto">
              {participants.map((participant, index) => (
                <HStack
                  key={getParticipantKey(participant, index)}
                  className="px-2 py-2 hover:bg-background-contrast-100 rounded-lg transition-colors"
                  $css={{ gap: '$200', alignItems: 'center' }}
                >
                  <CustomAvatar
                    user={participant}
                    size="md"
                    showInitials
                  />
                  <VStack $css={{ gap: '$050' }}>
                    <HStack $css={{ gap: '$100', alignItems: 'center' }}>
                      <Text typography="body2" className="font-medium text-foreground-normal-200">
                        {participant.name}
                      </Text>
                    </HStack>
                    {participant.email && (
                      <Text typography="body3" foreground="hint">
                        {participant.email}
                      </Text>
                    )}
                  </VStack>
                </HStack>
              ))}
            </div>
          </VStack>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
};

export default ChatRoomInfo;
