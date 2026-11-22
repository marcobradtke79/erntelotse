// Installation and updates (docs/concept.md §7.6): registers the service worker, offers the
// browser's install prompt and announces a new version, which is used after a reload.

import { reactive } from 'vue';
import { showToast } from '../stores/toast.js';

export const pwa = reactive({
  /** The browser offered an install prompt (Chrome, Edge, Android) */
  canPrompt: false,
  /** Running as an installed app */
  installed: false,
  /** iPhone/iPad Safari: install only through the share menu */
  ios: false,
});

let deferredPrompt = null;
let waitingWorker = null;
let updateRequested = false;

function standalone() {
  return globalThis.matchMedia?.('(display-mode: standalone)').matches || globalThis.navigator?.standalone === true;
}

function announceUpdate(worker) {
  waitingWorker = worker;
  showToast('pwa.updateReady', { persistent: true, action: { key: 'pwa.reload', handler: applyUpdate } });
}

/** Lets the waiting service worker take over; the page reloads when it does. */
export function applyUpdate() {
  updateRequested = true;
  if (waitingWorker) waitingWorker.postMessage('skipWaiting');
  else location.reload();
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  pwa.canPrompt = false;
  return outcome === 'accepted';
}

export function initPwa() {
  pwa.installed = standalone();
  pwa.ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    pwa.canPrompt = true;
  });
  addEventListener('appinstalled', () => {
    deferredPrompt = null;
    pwa.canPrompt = false;
    pwa.installed = true;
  });

  // Service workers need http(s). On a local dev server they would keep serving cached files
  // while editing, so there they only run with ?sw in the address (see CLAUDE.md).
  if (!('serviceWorker' in navigator) || !isSecureContext) return;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (local && !new URLSearchParams(location.search).has('sw')) {
    navigator.serviceWorker.getRegistrations().then((list) => list.forEach((registration) => registration.unregister()));
    return;
  }
  const hadController = Boolean(navigator.serviceWorker.controller);
  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      // The first install also changes the controller (clients.claim); only a replaced
      // worker means a new version, and then every open tab reloads into it
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || (!hadController && !updateRequested)) return;
        reloading = true;
        location.reload();
      });
      // A version that finished installing while the app was closed
      if (registration.waiting && navigator.serviceWorker.controller) announceUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          // With no controller this is the first install, not an update
          if (worker.state === 'installed' && navigator.serviceWorker.controller) announceUpdate(worker);
        });
      });
      // Long-running tabs and installed apps check for a new version now and then
      setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    } catch (error) {
      console.warn('Service worker registration failed', error);
    }
  };
  if (document.readyState === 'complete') register();
  else addEventListener('load', register);
}
