import { createApp, watch } from 'vue';
import { i18n, applyLanguage } from './i18n/index.js';
import { storage, persistent } from './services/appStorage.js';
import { applyTheme } from './services/theme.js';
import { settings, initSettings } from './stores/settings.js';
import { initGardens } from './stores/gardens.js';
import { showToast } from './stores/toast.js';
import { router } from './router.js';
import App from './App.js';

initSettings(storage);
applyLanguage(settings.language);
applyTheme(settings.theme);
watch(() => settings.language, applyLanguage);
watch(() => settings.theme, applyTheme);

initGardens(storage);

if (!persistent) showToast('errors.storageUnavailable', { type: 'error', persistent: true });

createApp(App).use(i18n).use(router).mount('#app');
