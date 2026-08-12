export const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;

export const createSessionUser = (userData, now = Date.now()) => ({
  ...userData,
  lastActivity: now,
});

export const isSessionExpired = (
  userData,
  now = Date.now(),
  timeoutMs = SESSION_TIMEOUT_MS
) => {
  if (!userData?.lastActivity) {
    return false;
  }

  return now - userData.lastActivity > timeoutMs;
};
