// Tool palette of the map (docs/design-rules.md §6): exactly one tool is active.
// The tools come from the view: elements on the garden map, plantings in the bed editor.

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

const toolItem = (id) => ({ id, icon: TYPE_ICONS[id], labelKey: `elements.types.${id}` });

/** Tools of the garden map */
export const ELEMENT_TOOLS = ['parcel', 'bed', 'tree', 'shrub'].map(toolItem);
export const MORE_ELEMENT_TOOLS = ['building', 'greenhouse', 'compost', 'pond', 'lawn', 'path', 'fence', 'hedge'].map(toolItem);

export default {
  name: 'ToolPalette',
  components: { AppIcon },
  props: {
    /** [{ id, icon, labelKey }] */
    items: { type: Array, required: true },
    more: { type: Array, default: () => [] },
    /** active tool id, 'measure' or null for select */
    active: { type: String, default: null },
    snapping: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
  },
  emits: ['pick', 'toggle-snapping'],
  setup(props, { emit }) {
    const { t } = useI18n();
    const moreOpen = ref(false);
    const root = ref(null);
    const activeMore = computed(() => props.more.find((item) => item.id === props.active) ?? null);

    function pick(id) {
      moreOpen.value = false;
      emit('pick', id);
    }

    function onDocumentClick(event) {
      if (moreOpen.value && root.value && !root.value.contains(event.target)) moreOpen.value = false;
    }

    onMounted(() => document.addEventListener('click', onDocumentClick));
    onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));

    return { t, moreOpen, root, activeMore, pick };
  },
  template: `
    <div class="tool-palette" ref="root" role="toolbar" :aria-label="t('map.tools.label')" @keydown.esc="moreOpen = false">
      <button type="button" class="tool-button" :aria-pressed="active === null ? 'true' : 'false'" :title="t('map.tools.select')" @click="pick(null)">
        <AppIcon name="pointer" :label="t('map.tools.select')" />
      </button>
      <button v-for="item in items" :key="item.id" type="button" class="tool-button" :aria-pressed="active === item.id ? 'true' : 'false'" :disabled="disabled" :title="t(item.labelKey)" @click="pick(item.id)">
        <AppIcon :name="item.icon" :label="t(item.labelKey)" />
      </button>
      <div v-if="more.length" class="tool-more">
        <button type="button" class="tool-button" :aria-pressed="activeMore ? 'true' : 'false'" :aria-expanded="moreOpen ? 'true' : 'false'" :disabled="disabled" :title="t('map.tools.more')" @click="moreOpen = !moreOpen">
          <AppIcon :name="activeMore ? activeMore.icon : 'shapes'" :label="t('map.tools.more')" />
        </button>
        <ul v-show="moreOpen" class="menu-list tool-more-list">
          <li v-for="item in more" :key="item.id">
            <button type="button" class="menu-item" :aria-current="active === item.id ? 'true' : null" @click="pick(item.id)">
              <AppIcon :name="item.icon" />
              <span>{{ t(item.labelKey) }}</span>
            </button>
          </li>
        </ul>
      </div>
      <span class="tool-separator" aria-hidden="true"></span>
      <button type="button" class="tool-button" :aria-pressed="active === 'measure' ? 'true' : 'false'" :title="t('map.tools.measure')" @click="pick('measure')">
        <AppIcon name="ruler" :label="t('map.tools.measure')" />
      </button>
      <button type="button" class="tool-button" :aria-pressed="snapping ? 'true' : 'false'" :title="t('map.tools.snapping')" @click="$emit('toggle-snapping')">
        <AppIcon name="magnet" :label="t('map.tools.snapping')" />
      </button>
    </div>
  `,
};
