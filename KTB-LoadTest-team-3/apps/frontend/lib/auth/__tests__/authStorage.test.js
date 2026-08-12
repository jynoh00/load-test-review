import { beforeEach, describe, expect, it } from 'vitest';
import {
  USER_STORAGE_KEY,
  loadStoredUser,
  saveStoredUser,
} from '../authStorage';

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads a valid stored user and refreshes lastActivity', () => {
    localStorage.setItem(
      USER_STORAGE_KEY,
      JSON.stringify({
        id: 'user-1',
        token: 'token-1',
        lastActivity: 1_000,
      })
    );

    const user = loadStoredUser({ storage: localStorage, now: 2_000 });

    expect(user).toMatchObject({
      id: 'user-1',
      token: 'token-1',
      lastActivity: 2_000,
    });
    expect(JSON.parse(localStorage.getItem(USER_STORAGE_KEY))).toMatchObject({
      id: 'user-1',
      lastActivity: 2_000,
    });
  });

  it('returns null when no user is stored', () => {
    expect(loadStoredUser({ storage: localStorage, now: 2_000 })).toBeNull();
  });

  it('clears corrupt stored user values', () => {
    localStorage.setItem(USER_STORAGE_KEY, '{not-json');

    expect(loadStoredUser({ storage: localStorage, now: 2_000 })).toBeNull();
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
  });

  it('clears expired sessions', () => {
    localStorage.setItem(
      USER_STORAGE_KEY,
      JSON.stringify({
        id: 'user-1',
        lastActivity: 1_000,
      })
    );

    const user = loadStoredUser({
      storage: localStorage,
      now: 2 * 60 * 60 * 1_000 + 1_001,
    });

    expect(user).toBeNull();
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
  });

  it('saves users with a refreshed activity timestamp', () => {
    const user = saveStoredUser(
      { id: 'user-1', token: 'token-1' },
      { storage: localStorage, now: 3_000 }
    );

    expect(user).toMatchObject({
      id: 'user-1',
      token: 'token-1',
      lastActivity: 3_000,
    });
    expect(JSON.parse(localStorage.getItem(USER_STORAGE_KEY))).toMatchObject(user);
  });
});
