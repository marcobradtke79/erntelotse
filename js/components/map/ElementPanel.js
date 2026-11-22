// Details of the selected element: name, measurements, exact size, edit mode, delete.

import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { measure, NAME_MAX_LENGTH } from '../../logic/elements.js';
import { resizeRectangle, rotate } from '../../logic/geometry.js';
import { formatArea, formatLength } from '../../logic/units.js';
import AppIcon from '../AppIcon.js';
import LengthInput from '../LengthInput.js';
import { TYPE_ICONS } from './ToolPalette.js';
import { elementName } from './elementText.js';

export default {
  name: 'ElementPanel',
  components: { AppIcon, LengthInput },
  props: {
    element: { type: Object, required: true },
    units: { type: String, default: 'metric' },
    editMode: { type: String, default: 'shape' },
  },
  emits: ['close', 'update', 'geometry', 'mode', 'delete'],
  setup(props, { emit }) {
    const { t, locale } = useI18n();
    const name = ref(props.element.name);
    watch(() => props.element.name, (value) => {
      name.value = value;
    });

    const kind = computed(() => props.element.geometry.kind);
    const result = computed(() => measure(props.element));
    const rect = computed(() => (kind.value === 'polygon' ? result.value.rectangle : null));
    const title = computed(() => elementName(props.element, t));
    const length = (value) => formatLength(value, props.units, locale.value);
    const area = (value) => formatArea(value, props.units, locale.value);
    const yearNow = new Date().getFullYear();

    function saveName() {
      const value = name.value.trim().slice(0, NAME_MAX_LENGTH);
      if (value !== props.element.name) emit('update', { name: value });
    }

    function setRectangle(width, depth) {
      const points = resizeRectangle(props.element.geometry.points, width, depth);
      if (points) emit('geometry', { kind: 'polygon', points });
    }

    function setRotation(degrees) {
      const current = rect.value;
      if (!current) return;
      emit('geometry', { kind: 'polygon', points: rotate(props.element.geometry.points, degrees - current.rotation, current.center) });
    }

    function setDiameter(diameter) {
      emit('geometry', { ...props.element.geometry, radius: diameter / 2 });
    }

    function setLineWidth(width) {
      emit('geometry', { ...props.element.geometry, width });
    }

    function setYear(event) {
      const raw = event.target.value.trim();
      const year = raw === '' ? null : Number(raw);
      if (year !== null && (!Number.isInteger(year) || year < 1800 || year > yearNow + 1)) {
        event.target.value = props.element.plantedYear ?? '';
        return;
      }
      emit('update', { plantedYear: year });
    }

    const modes = computed(() => (kind.value === 'circle' ? ['shape', 'move'] : ['shape', 'move', 'rotate']));
    const modeIcons = { shape: 'edit', move: 'move', rotate: 'rotate' };
    const modeHintKey = computed(() => {
      if (props.editMode !== 'shape') return props.editMode;
      if (kind.value === 'circle') return 'shapeCircle';
      if (kind.value === 'line') return 'shapeLine';
      return 'shape';
    });

    return {
      t, name, kind, result, rect, title, length, area, saveName, setRectangle, setRotation,
      setDiameter, setLineWidth, setYear, modes, modeIcons, modeHintKey, TYPE_ICONS, NAME_MAX_LENGTH, yearNow,
      roundAngle: (value) => Math.round(value * 10) / 10,
    };
  },
  template: `
    <section class="element-panel" :aria-label="title">
      <div class="panel-header">
        <button type="button" class="btn btn-icon" :title="t('map.panel.back')" @click="$emit('close')">
          <AppIcon name="chevron-left" :label="t('map.panel.back')" />
        </button>
        <AppIcon :name="TYPE_ICONS[element.type]" />
        <h2>{{ title }}</h2>
      </div>
      <p class="muted small">{{ t('elements.types.' + element.type) }}</p>

      <div class="field">
        <label for="element-name">{{ t('common.name') }}</label>
        <input id="element-name" v-model="name" class="input" type="text" :maxlength="NAME_MAX_LENGTH" autocomplete="off" @change="saveName" @keydown.enter="saveName" />
      </div>

      <dl class="measure-list">
        <template v-if="kind === 'polygon'">
          <div><dt>{{ t('map.panel.area') }}</dt><dd>{{ area(result.area) }}</dd></div>
          <div><dt>{{ t('map.panel.perimeter') }}</dt><dd>{{ length(result.perimeter) }}</dd></div>
        </template>
        <template v-else-if="kind === 'circle'">
          <div><dt>{{ t('map.panel.area') }}</dt><dd>{{ area(result.area) }}</dd></div>
        </template>
        <template v-else>
          <div><dt>{{ t('map.panel.length') }}</dt><dd>{{ length(result.length) }}</dd></div>
        </template>
      </dl>

      <div v-if="rect" class="size-grid">
        <LengthInput :label="t('map.panel.width')" :units="units" :model-value="rect.width" @update:model-value="setRectangle($event, rect.depth)" />
        <LengthInput :label="t('map.panel.depth')" :units="units" :model-value="rect.depth" @update:model-value="setRectangle(rect.width, $event)" />
        <LengthInput :label="t('map.panel.rotation')" quantity="degrees" :model-value="roundAngle(rect.rotation)" @update:model-value="setRotation" />
      </div>
      <p v-else-if="kind === 'polygon'" class="field-hint">{{ t('map.panel.freeShapeHint') }}</p>
      <LengthInput v-if="kind === 'circle'" :label="t('map.panel.diameter')" :units="units" :model-value="result.diameter" @update:model-value="setDiameter" />
      <LengthInput v-if="kind === 'line'" :label="t('map.panel.width')" :units="units" :model-value="element.geometry.width" @update:model-value="setLineWidth" />

      <div v-if="element.type === 'tree' || element.type === 'shrub'" class="field">
        <label for="element-year">{{ t('map.panel.plantedYear') }}</label>
        <input id="element-year" class="input" type="number" inputmode="numeric" min="1800" :max="yearNow + 1" step="1" :value="element.plantedYear ?? ''" @change="setYear" />
      </div>

      <fieldset class="field">
        <legend>{{ t('map.panel.editMode') }}</legend>
        <div class="choice-group">
          <label class="choice" v-for="mode in modes" :key="mode">
            <input type="radio" name="edit-mode" :value="mode" :checked="editMode === mode" @change="$emit('mode', mode)" />
            <span><AppIcon :name="modeIcons[mode]" />{{ t('map.panel.mode.' + mode) }}</span>
          </label>
        </div>
        <p class="field-hint">{{ t('map.panel.modeHint.' + modeHintKey) }}</p>
      </fieldset>

      <div class="btn-row">
        <button type="button" class="btn btn-danger-outline" @click="$emit('delete')">
          <AppIcon name="trash" />
          <span>{{ t('common.delete') }}</span>
        </button>
      </div>
    </section>
  `,
};
