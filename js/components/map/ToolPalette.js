// Tool palette of the map (docs/design-rules.md §6): exactly one tool is active.

import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import AppIcon from '../AppIcon.js';

export const TYPE_ICONS = {
  parcel: 'parcel',
  bed: 'bed',
  tree: 'tree',
  shrub: 'shrub',
  building: 'garden',
  greenhouse: 'rectangle',
  compost: 'rectangle',
  pond: 'polygon',
  lawn: 'polygon',
  path: 'path',
  fence: 'parcel',
  hedge: 'shrub',
};

const MAIN = ['parcel', 'bed', 'tree', 'shrub'];
const OTHER = ['building', 'greenhouse', 'compost', 'pond', 'lawn', 'path', 'fence', 'hedge'];

export default {
  name: 'ToolPalette',
  components: { AppIcon },
  props: {
    /** active tool type, 'measure' or null for select */
    active: { type: String, default: null },
    snapping: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
  },
  emits: ['pick', 'toggle-snapping'],
  setup(props, { emit }) {
    const { t } = useI18n();
    const moreOpen = ref(false);
    const root = ref(null);
    const otherActive = computed(() => OTHER.includes(props.active));

    function pick(type) {
      moreOpen.value = false;
      emit('pick', type);
    }

    function onDocumentClick(event) {
      if (moreOpen.value && root.value && !root.value.contains(event.target)) moreOpen.value = false;
    }

    onMounted(() => document.addEventListener('click', onDocumentClick));
    onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));

    return { t, MAIN, OTHER, TYPE_ICONS, moreOpen, root, otherActive, pick };
  },
  template: `
    <div class="tool-palette" ref="root" role="toolbar" :aria-label="t('map.tools.label')" @keydown.esc="moreOpen = false">
      <button type="button" class="tool-button" :aria-pressed="active === null ? 'true' : 'false'" :disabled="disabled" :title="t('map.tools.select')" @click="pick(null)">
        <AppIcon name="pointer" :label="t('map.tools.select')" />
      </button>
      <button v-for="type in MAIN" :key="type" type="button" class="tool-button" :aria-pressed="active === type ? 'true' : 'false'" :disabled="disabled" :title="t('elements.types.' + type)" @click="pick(type)">
        <AppIcon :name="TYPE_ICONS[type]" :label="t('elements.types.' + type)" />
      </button>
      <div class="tool-more">
        <button type="button" class="tool-button" :aria-pressed="otherActive ? 'true' : 'false'" :aria-expanded="moreOpen ? 'true' : 'false'" :disabled="disabled" :title="t('map.tools.more')" @click="moreOpen = !moreOpen">
          <AppIcon :name="otherActive ? TYPE_ICONS[active] : 'shapes'" :label="t('map.tools.more')" />
        </button>
        <ul v-show="moreOpen" class="menu-list tool-more-list">
          <li v-for="type in OTHER" :key="type">
            <button type="button" class="menu-item" :aria-current="active === type ? 'true' : null" @click="pick(type)">
              <AppIcon :name="TYPE_ICONS[type]" />
              <span>{{ t('elements.types.' + type) }}</span>
            </button>
          </li>
        </ul>
      </div>
      <span class="tool-separator" aria-hidden="true"></span>
      <button type="button" class="tool-button" :aria-pressed="active === 'measure' ? 'true' : 'false'" :disabled="disabled" :title="t('map.tools.measure')" @click="pick('measure')">
        <AppIcon name="ruler" :label="t('map.tools.measure')" />
      </button>
      <button type="button" class="tool-button" :aria-pressed="snapping ? 'true' : 'false'" :disabled="disabled" :title="t('map.tools.snapping')" @click="$emit('toggle-snapping')">
        <AppIcon name="magnet" :label="t('map.tools.snapping')" />
      </button>
    </div>
  `,
};
