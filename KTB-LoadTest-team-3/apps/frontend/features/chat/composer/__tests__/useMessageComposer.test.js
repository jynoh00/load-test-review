import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMessageComposer } from '../useMessageComposer';

describe('useMessageComposer', () => {
  it('opens mention suggestions while typing an @ query', () => {
    const { result } = renderHook(() => useMessageComposer());

    act(() => {
      result.current.handleMessageChange({
        target: {
          value: 'hello @Ki',
          selectionStart: 9,
        },
      });
    });

    expect(result.current.message).toBe('hello @Ki');
    expect(result.current.showMentionList).toBe(true);
    expect(result.current.mentionFilter).toBe('ki');
    expect(result.current.mentionIndex).toBe(0);
  });

  it('filters participants with the mention query', () => {
    const { result } = renderHook(() => useMessageComposer());

    act(() => {
      result.current.setMentionFilter('kim');
    });

    expect(
      result.current.getFilteredParticipants({
        participants: [
          { name: 'Kim User', email: 'kim@example.com' },
          { name: 'Lee User', email: 'lee@example.com' },
        ],
      })
    ).toEqual([{ name: 'Kim User', email: 'kim@example.com' }]);
  });

  it('inserts a selected mention at the current @ query', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMessageComposer());
    const input = {
      selectionStart: 8,
      focus: vi.fn(),
      setSelectionRange: vi.fn(),
    };

    act(() => {
      result.current.setMessage('hello @k');
      result.current.setShowMentionList(true);
    });

    act(() => {
      result.current.insertMention({ current: input }, { name: 'Kim' });
    });

    expect(result.current.message).toBe('hello @Kim ');
    expect(result.current.showMentionList).toBe(false);

    act(() => {
      vi.runAllTimers();
    });

    expect(input.focus).toHaveBeenCalled();
    expect(input.setSelectionRange).toHaveBeenCalledWith(11, 11);
    vi.useRealTimers();
  });
});
