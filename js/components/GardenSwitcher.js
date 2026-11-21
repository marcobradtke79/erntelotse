// Header control showing the active garden; opens a list to switch gardens.

import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { gardens, selectGarden } from '../stores/gardens.js';
import { settings } from '../stores/settings.js';
import AppIcon from './AppIcon.js';

export default {
  name: 'GardenSwitcher',
  components: { AppIcon },
  setup() {
    const { t, locale } = useI18n();
    const router = useRouter();
    const open = ref(false);
    const root = ref(null);
    const button = ref(null);

    const sorted = computed(() => [...gardens.index].sort((a, b) => a.name.localeCompare(b.name, locale.value)));
    const activeName = computed(() => gardens.index.find((entry) => entry.id === settings.activeGardenId)?.name ?? t('switcher.noGarden'));

    function toggle() {
      open.value = !open.value;
    }

    function close({ focusButton = false } = {}) {
      open.value = false;
      if (focusButton) button.value?.focus();
    }

    function choose(id) {
      selectGarden(id);
      close({ focusButton: true });
    }

    function manage() {
      close();
      router.push('/gardens');
    }

    function onDocumentClick(event) {
      if (open.value && root.value && !root.value.contains(event.target)) close();
    }

    function onKeydown(event) {
      if (event.key === 'Escape' && open.value) {
        event.stopPropagation();
        close({ focusButton: true });
      }
    }

    onMounted(() => document.addEventListener('click', onDocumentClick));
    onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));

    return { t, gardens, settings, open, root, button, sorted, activeName, toggle, choose, manage, onKeydown };
  },
  template: `
    <div class="menu" ref="root" @keydown="onKeydown">
      <router-link v-if="gardens.index.length === 0" to="/gardens" class="btn btn-secondary">
        <AppIcon name="plus" />
        <span>{{ t('switcher.create') }}</span>
      </router-link>
      <template v-else>
        <button
          ref="button"
          type="button"
          class="btn btn-secondary menu-button"
          :aria-expanded="open ? 'true' : 'false'"
          aria-controls="garden-switcher-list"
          :aria-label="t('switcher.label', { name: activeName })"
          @click="toggle"
        >
          <AppIcon name="garden" />
          <span class="menu-button-label">{{ activeName }}</span>
          <AppIcon name="chevron-down" />
        </button>
        <ul v-show="open" id="garden-switcher-list" class="menu-list">
          <li v-for="entry in sorted" :key="entry.id">
            <button type="button" class="menu-item" :aria-current="entry.id === settings.activeGardenId ? 'true' : null" @click="choose(entry.id)">
              <AppIcon :name="entry.id === settings.activeGardenId ? 'check' : 'garden'" />
              <span>{{ entry.name }}</span>
            </button>
          </li>
          <li class="menu-separator" role="separator"></li>
          <li>
            <button type="button" class="menu-item" @click="manage">
              <AppIcon name="settings" />
              <span>{{ t('switcher.manage') }}</span>
            </button>
          </li>
        </ul>
      </template>
    </div>
  `,
};
