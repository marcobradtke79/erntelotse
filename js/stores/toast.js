// Toast messages. Stores keep message keys; ToastHost translates them.

import { reactive } from 'vue';

let nextId = 1;

export const toasts = reactive([]);

/**
 * @param {string} key       message key
 * @param {object} [options] { params, type: 'info' | 'error', action: { key, handler }, duration, persistent }
 */
export function showToast(key, options = {}) {
  const toast = {
    id: nextId++,
    key,
    params: options.params ?? {},
    type: options.type ?? 'info',
    action: options.action ?? null,
  };
  toasts.push(toast);
  if (!options.persistent) {
    const duration = options.duration ?? (toast.type === 'error' || toast.action ? 8000 : 4000);
    setTimeout(() => dismissToast(toast.id), duration);
  }
  return toast.id;
}

export function showError(key, params) {
  return showToast(key, { type: 'error', params });
}

export function dismissToast(id) {
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index !== -1) toasts.splice(index, 1);
}
