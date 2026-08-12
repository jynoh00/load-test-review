import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { LikeIcon, CopyIcon } from '@vapor-ui/icons';
import { Button, IconButton, VStack, HStack, Box } from '@vapor-ui/core';
import EmojiPicker from './EmojiPicker';
import { Toast } from './Toast';

const FALLBACK_COPY_ELEMENT_ID = 'message-copy-fallback';

const selectTextForManualCopy = (text) => {
  if (typeof document === 'undefined') {
    return false;
  }

  const previousTextarea = document.getElementById(FALLBACK_COPY_ELEMENT_ID);
  previousTextarea?.remove();

  const textarea = document.createElement('textarea');
  textarea.id = FALLBACK_COPY_ELEMENT_ID;
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  return true;
};

const copyTextToClipboard = async (text) => {
  const selected = selectTextForManualCopy(text);

  if (selected && document.execCommand?.('copy')) {
    const textarea = document.getElementById(FALLBACK_COPY_ELEMENT_ID);
    textarea?.remove();
    return 'copied';
  }

  const clipboard = typeof navigator !== 'undefined'
    ? navigator.clipboard
    : typeof window !== 'undefined'
      ? window.navigator?.clipboard
      : null;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      const textarea = document.getElementById(FALLBACK_COPY_ELEMENT_ID);
      textarea?.remove();
      return 'copied';
    } catch (error) {
      if (selected) {
        return 'selected';
      }
      throw error;
    }
  }

  if (selected) {
    return 'selected';
  }

  return false;
};

const MessageActions = ({ 
  messageId,
  messageContent,
  reactions,
  currentUserId,
  onReactionAdd,
  onReactionRemove,
  isMine = false,
  room = null
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [tooltipStates, setTooltipStates] = useState({});
  const [leftOffset, setLeftOffset] = useState(0);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const containerRef = useRef(null);
  const reactionRefs = useRef({});
  const rafId = useRef(null);

  const handleClickOutside = useCallback((event) => {
    const isClickInsideEmojiPicker = emojiPickerRef.current?.contains(event.target);
    const isClickOnEmojiButton = emojiButtonRef.current?.contains(event.target);

    if (!isClickInsideEmojiPicker && !isClickOnEmojiButton) {
      setShowEmojiPicker(false);
    }
  }, []);

  useEffect(() => {
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker, handleClickOutside]);

  const handleCopy = useCallback(async () => {
    try {
      const copyStatus = await copyTextToClipboard(messageContent);
      if (copyStatus === 'copied') {
        Toast.success('메시지가 클립보드에 복사되었습니다.');
        return;
      }

      if (copyStatus === 'selected') {
        Toast.info('브라우저가 자동 복사를 지원하지 않아 메시지를 선택했습니다. Cmd+C로 복사해주세요.');
        return;
      }

      if (!copyStatus) {
        throw new Error('Clipboard copy failed');
      }
    } catch (error) {
      console.error('Copy failed:', error);
      Toast.error('메시지 복사에 실패했습니다.');
    }
  }, [messageContent]);

  const handleReactionSelect = useCallback((emoji) => {
    try {
      const emojiChar = emoji.native || emoji;
      const hasReacted = reactions?.[emojiChar]?.includes(currentUserId);

      if (hasReacted) {
        onReactionRemove?.(messageId, emojiChar);
      } else {
        onReactionAdd?.(messageId, emojiChar);
      }
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Reaction handling error:', error);
    }
  }, [messageId, reactions, currentUserId, onReactionAdd, onReactionRemove]);

  const toggleTooltip = useCallback((emoji) => {
    setTooltipStates(prev => ({
      ...prev,
      [emoji]: !prev[emoji]
    }));
  }, []);

  const getReactionTooltip = useCallback((emoji, userIds) => {
    if (!userIds || !room?.participants) {
      return '';
    }

    // room.participants가 배열인지 확인
    if (!Array.isArray(room.participants)) {
      console.warn('room.participants is not an array:', room.participants);
      return '';
    }

    // 사용자 ID들을 문자열로 변환하여 비교하기 위한 Map 생성
    const participantMap = new Map(
      room.participants.map(p => [
        String(p._id || p.id), 
        p.name
      ])
    );

    const reactionUsers = userIds.map(userId => {
      const userIdStr = String(userId);
      
      // 현재 사용자인 경우
      if (userIdStr === String(currentUserId)) {
        return '나';
      }
      
      // 참여자 목록에서 해당 사용자 찾기
      const userName = participantMap.get(userIdStr);
      return userName || '알 수 없는 사용자';
    });

    // 중복 제거 및 정렬
    const uniqueUsers = [...new Set(reactionUsers)].sort((a, b) => {
      if (a === '나') return -1;
      if (b === '나') return 1;
      return a.localeCompare(b);
    });

    return uniqueUsers.join(', ');
  }, [currentUserId, room]);

  const renderReactions = useCallback(() => {
    if (!reactions || Object.keys(reactions).length === 0) {
      return null;
    }

    return (
      <HStack $css={{ gap: '$050' }}>
        {Object.entries(reactions).map(([emoji, users]) => {
          const reactionId = `reaction-${messageId}-${emoji}`;

          if (!reactionRefs.current[emoji]) {
            reactionRefs.current[emoji] = React.createRef();
          }

          const tooltipContent = getReactionTooltip(emoji, users);

          return (
            <Button
              key={emoji}
              ref={reactionRefs.current[emoji]}
              id={reactionId}
              size="sm"
              variant="ghost"
              $css={{ color: 'fg-hint-100' }}
              className="flex items-center gap-1"
              onClick={() => handleReactionSelect(emoji)}
              onMouseEnter={() => toggleTooltip(emoji)}
              onMouseLeave={() => toggleTooltip(emoji)}
              data-bs-toggle="tooltip"
              data-bs-placement="top"
              title={tooltipContent}
              data-testid={`message-reaction-${messageId}-${emoji}`}
            >
              <span className="text-base">{emoji}</span>
              <span className="text-xs font-medium">{users.length}</span>
            </Button>
          );
        })}
      </HStack>
    );
  }, [reactions, messageId, currentUserId, tooltipStates, handleReactionSelect, toggleTooltip, getReactionTooltip]);

  const toggleEmojiPicker = useCallback((e) => {    
    e.stopPropagation();
    setShowEmojiPicker(prev => !prev);
  }, []);

  // Calculate emoji picker position
  const getEmojiPickerPosition = useCallback(() => {
    if (!emojiButtonRef.current) return { top: 0, left: 0 };
    
    const buttonRect = emojiButtonRef.current.getBoundingClientRect();
    const pickerHeight = 350; // Approximate height
    const pickerWidth = 350; // Approximate width
    const buttonHeight = buttonRect.height;
    
    // Position above the left edge of the emoji button with gap
    let top = buttonRect.top - pickerHeight - 15; // 15px gap above button
    let left = buttonRect.left; // Align with left edge of button
    
    // If not enough space above, show below the button
    if (top < 10) {
      top = buttonRect.bottom + 15; // 15px gap below button
    }
    
    // Ensure picker doesn't go off the right edge
    if (left + pickerWidth > window.innerWidth) {
      left = window.innerWidth - pickerWidth - 10;
    }
    
    // Ensure picker doesn't go off the left edge
    if (left < 10) {
      left = 10;
    }
    
    return { top, left };
  }, []);

  return (
    <div className={`flex flex-col gap-2 ${isMine ? 'items-end' : 'items-start'}`} ref={containerRef}>
      {renderReactions()}

      <HStack $css={{ gap: '$050', alignItems: 'center' }}>
        <div className="relative">
          <IconButton
            ref={emojiButtonRef}
            size="sm"
            colorPalette={isMine ? 'primary' : 'contrast'}
            shape="square"
            variant="outline"
            className="bg-transparent! hover:bg-gray-800!"
            onClick={toggleEmojiPicker}
            aria-label="리액션 추가"
            data-testid="message-reaction-button"
          >
            <LikeIcon size={16} />
          </IconButton>

          {showEmojiPicker && typeof window !== 'undefined' && ReactDOM.createPortal(
            <div
              ref={emojiPickerRef}
              style={{
                position: 'fixed',
                zIndex: 9999,
                ...getEmojiPickerPosition()
              }}
              onClick={e => e.stopPropagation()}
              data-testid="emoji-picker-container"
            >
              <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
                <EmojiPicker
                  onSelect={handleReactionSelect}
                  emojiSize={20}
                  perLine={8}
                  theme="light"
                />
              </div>
            </div>,
            document.body
          )}
        </div>
        <IconButton
          size="sm"
          colorPalette={isMine ? 'primary' : 'contrast'}
          shape="square"
          variant="outline"
          className="bg-transparent! hover:bg-gray-800!"
          onClick={handleCopy}
          aria-label="메시지 복사"
        >
          <CopyIcon size={16} />
        </IconButton>
      </HStack>
    </div>
  );
};

MessageActions.defaultProps = {
  messageId: '',
  messageContent: '',
  reactions: {},
  currentUserId: null,
  onReactionAdd: () => {},
  onReactionRemove: () => {},
  isMine: false,
  room: null
};

export default React.memo(MessageActions);
