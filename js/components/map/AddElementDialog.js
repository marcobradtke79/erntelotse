// Adds an element by entering its size instead of drawing it (keyboard and precise input).

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ELEMENT_TYPES, TYPE_NAMES } from '../../logic/elements.js';
import AppDialog from '../AppDialog.js';
import LengthInput from '../LengthInput.js';

export default {
  name: 'AddElementDialog',
  components: { AppDialog, LengthInput },
  props: {
    open: { type: Boolean, default: false },
    units: { type: String, default: 'metric' },
    hasParcel: { type: Boolean, default: false },
    /** Type chosen when the dialog opens (e.g. the parcel in the garden setup) */
    initialType: { type: String, default: null },
  },
  emits: ['update:open', 'add'],
  setup(props, { emit }) {
    const { t } = useI18n();
    const type = ref('bed');
    const width = ref(2);
    const depth = ref(1.2);
    const diameter = ref(ELEMENT_TYPES.tree.diameter);

    const types = computed(() => TYPE_NAMES.filter((name) => !(name === 'parcel' && props.hasParcel)));
    const kind = computed(() => ELEMENT_TYPES[type.value].kind);

    watch(type, (value) => {
      const config = ELEMENT_TYPES[value];
      if (config.kind === 'circle') diameter.value = config.diameter;
      if (config.kind === 'line') {
        width.value = 5;
        depth.value = config.width;
      }
      if (config.kind === 'polygon') {
        width.value = value === 'parcel' ? 20 : 2;
        depth.value = value === 'parcel' ? 30 : 1.2;
      }
    });

    watch(() => props.open, (open) => {
      if (!open) return;
      if (props.initialType && types.value.includes(props.initialType)) type.value = props.initialType;
      else if (!types.value.includes(type.value)) type.value = 'bed';
    });

    function submit() {
      emit('add', { type: type.value, width: width.value, depth: depth.value, diameter: diameter.value });
      emit('update:open', false);
    }

    return { t, type, types, kind, width, depth, diameter, submit };
  },
  template: `
    <AppDialog :open="open" :title="t('map.add.title')" @update:open="$emit('update:open', $event)">
      <form id="add-element-form" class="settings-list" @submit.prevent="submit">
        <div class="field">
          <label for="add-element-type">{{ t('map.add.type') }}</label>
          <select id="add-element-type" v-model="type" class="select" autofocus>
            <option v-for="name in types" :key="name" :value="name">{{ t('elements.types.' + name) }}</option>
          </select>
        </div>
        <div v-if="kind === 'polygon'" class="size-grid">
          <LengthInput v-model="width" :label="t('map.panel.width')" :units="units" />
          <LengthInput v-model="depth" :label="t('map.panel.depth')" :units="units" />
        </div>
        <LengthInput v-if="kind === 'circle'" v-model="diameter" :label="t('map.panel.diameter')" :units="units" />
        <div v-if="kind === 'line'" class="size-grid">
          <LengthInput v-model="width" :label="t('map.panel.length')" :units="units" />
          <LengthInput v-model="depth" :label="t('map.panel.width')" :units="units" />
        </div>
        <p class="field-hint">{{ t('map.add.hint') }}</p>
      </form>
      <template #actions>
        <button type="button" class="btn btn-text" @click="$emit('update:open', false)">{{ t('common.cancel') }}</button>
        <button type="submit" form="add-element-form" class="btn btn-primary">{{ t('map.add.submit') }}</button>
      </template>
    </AppDialog>
  `,
};
