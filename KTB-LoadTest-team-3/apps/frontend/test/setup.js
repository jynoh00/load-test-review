import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mocks/server';

const createMemoryStorage = () => {
  const store = new Map();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      const storageKey = String(key);
      return store.has(storageKey) ? store.get(storageKey) : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(String(key));
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
  };
};

const readStorage = (owner, key) => {
  try {
    return owner?.[key] ?? null;
  } catch {
    return null;
  }
};

const defineStorage = (owner, key, storage) => {
  if (!owner) return;

  Object.defineProperty(owner, key, {
    configurable: true,
    value: storage,
    writable: true,
  });
};

const ensureStorage = (key) => {
  const storage = readStorage(globalThis.window, key) ?? createMemoryStorage();

  defineStorage(globalThis.window, key, storage);
  defineStorage(globalThis, key, storage);
};

ensureStorage('localStorage');
ensureStorage('sessionStorage');

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
