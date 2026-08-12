export const deriveUniqueSortedMessages = (
  currentMessages,
  incomingMessages,
  processedMessageIds
) => {
  if (!Array.isArray(incomingMessages)) {
    throw new Error('Invalid messages format');
  }

  const processedSnapshot = new Set(processedMessageIds);
  const nextProcessedMessageIds = new Set(processedMessageIds);
  const newMessages = incomingMessages.filter((message) => {
    if (!message._id) {
      return false;
    }

    if (processedSnapshot.has(message._id)) {
      return false;
    }

    processedSnapshot.add(message._id);
    nextProcessedMessageIds.add(message._id);
    return true;
  });

  const allMessages = [...currentMessages, ...newMessages].sort((a, b) => {
    return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
  });

  const messageMap = new Map();
  allMessages.forEach((message) => messageMap.set(message._id, message));

  return {
    messages: Array.from(messageMap.values()),
    processedMessageIds: nextProcessedMessageIds,
  };
};

export const mergeUniqueSortedMessages = (
  currentMessages,
  incomingMessages,
  processedMessageIds
) => {
  return deriveUniqueSortedMessages(
    currentMessages,
    incomingMessages,
    processedMessageIds
  ).messages;
};
