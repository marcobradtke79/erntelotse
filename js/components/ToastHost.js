import { useI18n } from 'vue-i18n';
import { toasts, dismissToast } from '../stores/toast.js';
import AppIcon from './AppIcon.js';

export default {
  name: 'ToastHost',
  components: { AppIcon },
  setup() {
    const { t } = useI18n();

    function message(toast) {
      const count = toast.params?.count;
      return typeof count === 'number' ? t(toast.key, toast.params, count) : t(toast.key, toast.params);
    }

    function runAction(toast) {
      dismissToast(toast.id);
      toast.action.handler();
    }

    return { t, toasts, message, runAction, dismissToast };
  },
  template: `
    <div class="toast-host" aria-live="polite" aria-atomic="false">
      <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.type" :role="toast.type === 'error' ? 'alert' : 'status'">
        <AppIcon :name="toast.type === 'error' ? 'alert' : 'check'" />
        <span class="toast-message">{{ message(toast) }}</span>
        <button v-if="toast.action" type="button" class="btn btn-text" @click="runAction(toast)">{{ t(toast.action.key) }}</button>
        <button type="button" class="btn btn-icon" :title="t('a11y.dismiss')" @click="dismissToast(toast.id)">
          <AppIcon name="close" :label="t('a11y.dismiss')" />
        </button>
      </div>
    </div>
  `,
};
