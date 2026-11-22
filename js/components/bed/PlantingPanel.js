// Details of the selected planting: plant, dates, count, note, edit mode, delete.

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { plantById as getPlant } from '../../stores/catalog.js';
import { estimateCount, shapeArea, plantingStatus, defaultEnd, NOTE_MAX_LENGTH } from '../../logic/plantings.js';
import { isIsoDate, todayIso } from '../../logic/dates.js';
import { formatArea } from '../../logic/units.js';
import AppIcon from '../AppIcon.js';
import PlantSelect from '../PlantSelect.js';
import { plantName } from './plantingText.js';

export default {
  name: 'PlantingPanel',
  components: { AppIcon, PlantSelect },
  props: {
    planting: { type: Object, required: true },
    units: { type: String, default: 'metric' },
    editMode: { type: String, default: 'shape' },
    readOnly: { type: Boolean, default: false },
  },
  emits: ['close', 'update', 'mode', 'delete'],
  setup(props, { emit }) {
    const { t, locale } = useI18n();
    const plant = computed(() => getPlant(props.planting.plantId));
    const title = computed(() => plantName(props.planting.plantId, t));
    const status = computed(() => plantingStatus(props.planting, todayIso()));
    const estimate = computed(() => estimateCount(props.planting.shape, plant.value.spacing));
    const isArea = computed(() => props.planting.shape.kind === 'polygon');
    const area = computed(() => formatArea(shapeArea(props.planting.shape), props.units, locale.value));
    const dateError = ref('');
    const note = ref(props.planting.note);
    watch(() => props.planting.note, (value) => {
      note.value = value;
    });
    watch(() => props.planting.id, () => {
      dateError.value = '';
    });

    function setPlant(plantId) {
      if (!plantId || plantId === props.planting.plantId) return;
      const fields = { plantId };
      // A perennial has no end; an annual replacing a perennial gets a proposed end
      const next = getPlant(plantId);
      if (next.growDays === null) fields.end = null;
      else if (props.planting.end === null) fields.end = defaultEnd(next, props.planting.start);
      emit('update', fields);
    }

    function setStart(event) {
      const start = event.target.value;
      if (!isIsoDate(start)) {
        dateError.value = t('planting.errors.date');
        return;
      }
      if (props.planting.end !== null && props.planting.end < start) {
        dateError.value = t('planting.errors.endBeforeStart');
        event.target.value = props.planting.start;
        return;
      }
      dateError.value = '';
      emit('update', { start });
    }

    function setEnd(event) {
      const end = event.target.value;
      if (!isIsoDate(end)) {
        dateError.value = t('planting.errors.date');
        return;
      }
      if (end < props.planting.start) {
        dateError.value = t('planting.errors.endBeforeStart');
        event.target.value = props.planting.end ?? '';
        return;
      }
      dateError.value = '';
      emit('update', { end });
    }

    function setOpenEnd(event) {
      emit('update', { end: event.target.checked ? null : defaultEnd({ growDays: plant.value.growDays ?? 90 }, props.planting.start) });
    }

    function setCount(event) {
      const raw = event.target.value.trim();
      if (raw === '') {
        emit('update', { count: null });
        return;
      }
      const count = Number(raw);
      if (!Number.isInteger(count) || count < 0) {
        event.target.value = props.planting.count ?? '';
        return;
      }
      emit('update', { count });
    }

    function saveNote() {
      const value = note.value.slice(0, NOTE_MAX_LENGTH);
      if (value !== props.planting.note) emit('update', { note: value });
    }

    const modes = computed(() => (isArea.value ? ['shape', 'move', 'rotate'] : ['move']));
    const modeIcons = { shape: 'edit', move: 'move', rotate: 'rotate' };

    return {
      t, plant, title, status, estimate, isArea, area, dateError, note, NOTE_MAX_LENGTH,
      setPlant, setStart, setEnd, setOpenEnd, setCount, saveNote, modes, modeIcons,
    };
  },
  template: `
    <section class="element-panel planting-panel" :aria-label="title">
      <div class="panel-header">
        <button type="button" class="btn btn-icon" :title="t('bed.backToBed')" @click="$emit('close')">
          <AppIcon name="chevron-left" :label="t('bed.backToBed')" />
        </button>
        <span class="plant-swatch" :style="{ background: plant.color }" aria-hidden="true"></span>
        <h2>{{ title }}</h2>
      </div>
      <p><span class="status-chip" :class="'is-' + status">{{ t('status.' + status) }}</span></p>

      <PlantSelect :model-value="planting.plantId" placement="bed" :label="t('planting.plant')" :disabled="readOnly" @update:model-value="setPlant" />

      <div class="size-grid">
        <div class="field">
          <label for="planting-start">{{ t('planting.start') }}</label>
          <input id="planting-start" class="input" type="date" :value="planting.start" :disabled="readOnly" required @change="setStart" />
        </div>
        <div class="field">
          <label for="planting-end">{{ t('planting.end') }}</label>
          <input id="planting-end" class="input" type="date" :value="planting.end ?? ''" :min="planting.start" :disabled="readOnly || planting.end === null" @change="setEnd" />
        </div>
      </div>
      <label class="checkbox-row">
        <input type="checkbox" :checked="planting.end === null" :disabled="readOnly" @change="setOpenEnd" />
        <span>{{ t('planting.openEnd') }}</span>
      </label>
      <p v-if="dateError" class="field-error" role="alert">{{ dateError }}</p>

      <div class="field">
        <label for="planting-count">{{ t('planting.count') }}</label>
        <input id="planting-count" class="input" type="number" inputmode="numeric" min="0" step="1" :value="planting.count ?? ''" :placeholder="String(estimate)" :disabled="readOnly" @change="setCount" />
        <p class="field-hint">{{ planting.count === null ? t('planting.countEstimated', { count: estimate }, estimate) : t('planting.countEstimate', { count: estimate }, estimate) }}</p>
      </div>

      <dl v-if="isArea" class="measure-list">
        <div><dt>{{ t('map.panel.area') }}</dt><dd>{{ area }}</dd></div>
      </dl>

      <div class="field">
        <label for="planting-note">{{ t('planting.note') }}</label>
        <textarea id="planting-note" v-model="note" class="input textarea" rows="2" :maxlength="NOTE_MAX_LENGTH" :disabled="readOnly" :placeholder="t('planting.notePlaceholder')" @change="saveNote"></textarea>
      </div>

      <fieldset v-if="!readOnly && modes.length > 1" class="field">
        <legend>{{ t('map.panel.editMode') }}</legend>
        <div class="choice-group">
          <label class="choice" v-for="mode in modes" :key="mode">
            <input type="radio" name="planting-edit-mode" :value="mode" :checked="editMode === mode" @change="$emit('mode', mode)" />
            <span><AppIcon :name="modeIcons[mode]" />{{ t('map.panel.mode.' + mode) }}</span>
          </label>
        </div>
      </fieldset>
      <p v-else-if="!readOnly" class="field-hint">{{ t('planting.moveHint') }}</p>

      <div class="btn-row" v-if="!readOnly">
        <button type="button" class="btn btn-danger-outline" @click="$emit('delete')">
          <AppIcon name="trash" />
          <span>{{ t('common.delete') }}</span>
        </button>
      </div>
    </section>
  `,
};
