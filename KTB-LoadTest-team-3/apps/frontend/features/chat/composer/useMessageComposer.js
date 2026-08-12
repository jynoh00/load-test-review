import { useCallback, useState } from 'react';

export const useMessageComposer = () => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);

  const handleMessageChange = useCallback((e) => {
    const newValue = e.target.value;
    setMessage(newValue);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPosition);
    const atSymbolIndex = textBeforeCursor.lastIndexOf('@');

    if (atSymbolIndex !== -1) {
      const mentionText = textBeforeCursor.slice(atSymbolIndex + 1);
      if (!mentionText.includes(' ')) {
        setMentionFilter(mentionText.toLowerCase());
        setShowMentionList(true);
        setMentionIndex(0);
        return;
      }
    }

    setShowMentionList(false);
  }, []);

  const handleEmojiToggle = useCallback(() => {
    setShowEmojiPicker((prev) => !prev);
  }, []);

  const getFilteredParticipants = useCallback(
    (room) => {
      if (!room?.participants) return [];

      return room.participants.filter(
        (user) =>
          user.name.toLowerCase().includes(mentionFilter) ||
          user.email.toLowerCase().includes(mentionFilter)
      );
    },
    [mentionFilter]
  );

  const insertMention = useCallback(
    (messageInputRef, user) => {
      if (!messageInputRef?.current) return;

      const cursorPosition = messageInputRef.current.selectionStart;
      const textBeforeCursor = message.slice(0, cursorPosition);
      const atSymbolIndex = textBeforeCursor.lastIndexOf('@');

      if (atSymbolIndex !== -1) {
        const textBeforeAt = message.slice(0, atSymbolIndex);
        const newMessage =
          textBeforeAt + `@${user.name} ` + message.slice(cursorPosition);

        setMessage(newMessage);
        setShowMentionList(false);

        setTimeout(() => {
          const newPosition = atSymbolIndex + user.name.length + 2;
          messageInputRef.current.focus();
          messageInputRef.current.setSelectionRange(newPosition, newPosition);
        }, 0);
      }
    },
    [message]
  );

  return {
    message,
    showEmojiPicker,
    showMentionList,
    mentionFilter,
    mentionIndex,
    setMessage,
    setShowEmojiPicker,
    setShowMentionList,
    setMentionFilter,
    setMentionIndex,
    handleMessageChange,
    handleEmojiToggle,
    getFilteredParticipants,
    insertMention,
  };
};
