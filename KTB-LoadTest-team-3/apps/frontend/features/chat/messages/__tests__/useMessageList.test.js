import { describe, expect, it } from 'vitest';
import {
  deriveUniqueSortedMessages,
  mergeUniqueSortedMessages,
} from '../useMessageList';

describe('mergeUniqueSortedMessages', () => {
  it('appends unseen messages in timestamp order without mutating processed ids', () => {
    const processedIds = new Set(['existing']);

    const result = deriveUniqueSortedMessages(
      [{ _id: 'existing', content: 'middle', timestamp: '2026-01-01T00:00:02Z' }],
      [
        { _id: 'late', content: 'late', timestamp: '2026-01-01T00:00:03Z' },
        { _id: 'early', content: 'early', timestamp: '2026-01-01T00:00:01Z' },
      ],
      processedIds
    );

    expect(result.messages.map((message) => message._id)).toEqual([
      'early',
      'existing',
      'late',
    ]);
    expect(processedIds).toEqual(new Set(['existing']));
    expect(result.processedMessageIds).toEqual(
      new Set(['existing', 'late', 'early'])
    );
  });

  it('ignores incoming duplicates and messages without ids', () => {
    const processedIds = new Set(['duplicate']);

    const messages = mergeUniqueSortedMessages(
      [{ _id: 'duplicate', content: 'original', timestamp: '2026-01-01T00:00:01Z' }],
      [
        { _id: 'duplicate', content: 'newer duplicate', timestamp: '2026-01-01T00:00:02Z' },
        { content: 'missing id', timestamp: '2026-01-01T00:00:03Z' },
      ],
      processedIds
    );

    expect(messages).toEqual([
      { _id: 'duplicate', content: 'original', timestamp: '2026-01-01T00:00:01Z' },
    ]);
  });

  it('throws for invalid incoming message payloads', () => {
    expect(() => mergeUniqueSortedMessages([], null, new Set())).toThrow(
      'Invalid messages format'
    );
  });

  it('returns stable results when called twice with the same inputs', () => {
    const processedIds = new Set(['existing']);
    const currentMessages = [
      { _id: 'existing', content: 'old', timestamp: '2026-01-01T00:00:01Z' },
    ];
    const incomingMessages = [
      { _id: 'next', content: 'new', timestamp: '2026-01-01T00:00:02Z' },
    ];

    const first = deriveUniqueSortedMessages(
      currentMessages,
      incomingMessages,
      processedIds
    );
    const second = deriveUniqueSortedMessages(
      currentMessages,
      incomingMessages,
      processedIds
    );

    expect(second.messages).toEqual(first.messages);
    expect(second.processedMessageIds).toEqual(first.processedMessageIds);
    expect(processedIds).toEqual(new Set(['existing']));
  });
});
