// The app's storage instance. Falls back to memory when localStorage is not usable.

import { createStorage, createMemoryBackend, localStorageAvailable } from './storage.js';

export const persistent = localStorageAvailable();

export const storage = createStorage(persistent ? globalThis.localStorage : createMemoryBackend());
