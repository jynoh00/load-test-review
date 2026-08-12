import { createSessionUser, isSessionExpired } from './session';

export const USER_STORAGE_KEY = 'user';
export const LAST_TOKEN_VERIFICATION_KEY = 'lastTokenVerification';

const getDefaultStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
};

export const clearStoredUser = (storage = getDefaultStorage()) => {
  storage?.removeItem(USER_STORAGE_KEY);
};

export const clearAuthStorage = (storage = getDefaultStorage()) => {
  clearStoredUser(storage);
  storage?.removeItem(LAST_TOKEN_VERIFICATION_KEY);
};

export const getLastTokenVerification = (storage = getDefaultStorage()) => {
  const storedValue = storage?.getItem(LAST_TOKEN_VERIFICATION_KEY);
  return storedValue ? parseInt(storedValue, 10) : null;
};

export const saveLastTokenVerification = (
  now = Date.now(),
  storage = getDefaultStorage()
) => {
  storage?.setItem(LAST_TOKEN_VERIFICATION_KEY, now.toString());
};

export const loadStoredUser = ({
  storage = getDefaultStorage(),
  now = Date.now(),
} = {}) => {
  if (!storage) {
    return null;
  }

  try {
    const userStr = storage.getItem(USER_STORAGE_KEY);
    if (!userStr) {
      return null;
    }

    const userData = JSON.parse(userStr);

    if (isSessionExpired(userData, now)) {
      clearStoredUser(storage);
      return null;
    }

    const activeUser = createSessionUser(userData, now);
    storage.setItem(USER_STORAGE_KEY, JSON.stringify(activeUser));

    return activeUser;
  } catch (error) {
    clearStoredUser(storage);
    return null;
  }
};

export const saveStoredUser = (
  userData,
  {
    storage = getDefaultStorage(),
    now = Date.now(),
  } = {}
) => {
  if (!storage) {
    return null;
  }

  if (!userData) {
    clearStoredUser(storage);
    return null;
  }

  const userToSave = createSessionUser(userData, now);
  storage.setItem(USER_STORAGE_KEY, JSON.stringify(userToSave));

  return userToSave;
};
