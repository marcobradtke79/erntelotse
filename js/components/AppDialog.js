// Modal dialog on the native <dialog> element (bottom sheet on phones via CSS).
// Closes with Esc, the close button and a click on the backdrop; focus returns to the opener.

import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import AppIcon from './AppIcon.js';

let counter = 0;

export default {
  name: 'AppDialog',
  components: { AppIcon },
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, required: true },
    /** Room for wide content such as a chart */
    wide: { type: Boolean, default: false },
  },
  emits: ['update:open', 'close'],
  setup(props, { emit }) {
    const { t } = useI18n();
    const dialog = ref(null);
    const titleId = `dialog-title-${++counter}`;
    let opener = null;

    function close() {
      emit('update:open', false);
      emit('close');
    }

    function sync(open) {
      const element = dialog.value;
      if (!element) return;
      if (open && !element.open) {
        opener = document.activeElement;
        element.showModal();
        nextTick(() => {
          const autofocus = element.querySelector('[autofocus]');
          autofocus?.focus();
        });
      } else if (!open && element.open) {
        element.close();
        if (opener && document.contains(opener)) opener.focus();
        opener = null;
      }
    }

    function onCancel(event) {
      event.preventDefault();
      close();
    }

    function onClick(event) {
      // A click on the <dialog> itself (not its content) is a click on the backdrop
      if (event.target === dialog.value) close();
    }

    watch(() => props.open, (open) => sync(open));
    onMounted(() => sync(props.open));
    onBeforeUnmount(() => {
      if (dialog.value?.open) dialog.value.close();
    });

    return { t, dialog, titleId, close, onCancel, onClick };
  },
  template: `
    <dialog ref="dialog" class="dialog" :class="{ 'dialog-wide': wide }" :aria-labelledby="titleId" @cancel="onCancel" @click="onClick">
      <div class="dialog-content" v-if="open">
        <div class="dialog-header">
          <h2 :id="titleId">{{ title }}</h2>
          <button type="button" class="btn btn-icon" :title="t('common.close')" @click="close">
            <AppIcon name="close" :label="t('common.close')" />
          </button>
        </div>
        <slot />
        <div class="dialog-actions" v-if="$slots.actions">
          <slot name="actions" />
        </div>
      </div>
    </dialog>
  `,
};
