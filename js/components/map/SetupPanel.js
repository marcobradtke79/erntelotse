// Guided setup of a new garden (docs/concept.md §3): place it on the map, trace the boundary,
// add structures for orientation, draw the beds, confirm the climate. Every step can be skipped or revisited.
// The panel only asks; MapView owns the drawing tools, the location mode and the selection.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { measure } from '../../logic/elements.js';
import { formatArea } from '../../logic/units.js';
import AppIcon from '../AppIcon.js';
import ClimateSettings from '../ClimateSettings.js';
import LocationBar from './LocationBar.js';
import { TYPE_ICONS } from './ToolPalette.js';
import { elementName, elementSummary } from './elementText.js';

export const SETUP_STEPS = ['place', 'boundary', 'structures', 'beds', 'climate'];
const STEP_ICONS = { place: 'pin', boundary: 'parcel', structures: 'shapes', beds: 'bed', climate: 'dashboard' };

/** Structures that help to find one's way around the plan */
export const STRUCTURE_TYPES = ['path', 'building', 'greenhouse', 'pond', 'tree', 'fence', 'hedge', 'lawn', 'compost'];

export default {
  name: 'SetupPanel',
  components: { AppIcon, ClimateSettings, LocationBar },
  props: {
    garden: { type: Object, required: true },
    step: { type: String, required: true },
    units: { type: String, default: 'metric' },
    online: { type: Boolean, default: true },
    /** Element type of the active drawing tool, or null */
    activeTool: { type: String, default: null },
    activeDraw: { type: String, default: null },
  },
  emits: ['step', 'draw', 'add-by-size', 'select', 'redraw-parcel', 'finish', 'close', 'fly', 'confirm-location', 'skip-location', 'remove-location'],
  setup(props, { emit }) {
    const { t, locale } = useI18n();
    const index = computed(() => SETUP_STEPS.indexOf(props.step));
    const parcel = computed(() => props.garden.elements.find((element) => element.type === 'parcel') ?? null);
    const parcelArea = computed(() => (parcel.value ? formatArea(measure(parcel.value).area, props.units, locale.value) : ''));
    const structures = computed(() => props.garden.elements.filter((element) => STRUCTURE_TYPES.includes(element.type)));
    const beds = computed(() => props.garden.elements.filter((element) => element.type === 'bed'));
    const hasContent = computed(() => {
      if (props.step === 'boundary') return Boolean(parcel.value);
      if (props.step === 'structures') return structures.value.length > 0;
      if (props.step === 'beds') return beds.value.length > 0;
      return true;
    });

    const toolLabel = (type) => (type === 'tree' ? t('setup.largeTree') : t(`elements.types.${type}`));
    const isActive = (type, draw = null) => props.activeTool === type && (draw === null || props.activeDraw === draw);

    function go(offset) {
      const next = SETUP_STEPS[index.value + offset];
      if (next) emit('step', next);
    }

    return {
      t, index, parcel, parcelArea, structures, beds, hasContent, SETUP_STEPS, STEP_ICONS, STRUCTURE_TYPES, TYPE_ICONS,
      toolLabel, isActive, go,
      name: (element) => elementName(element, t),
      summary: (element) => elementSummary(element, props.units, locale.value),
    };
  },
  template: `
    <section class="setup-panel" aria-labelledby="setup-title">
      <h2 id="setup-title">{{ t('setup.title', { name: garden.name }) }}</h2>
      <ol class="plain-list setup-steps">
        <li v-for="(name, i) in SETUP_STEPS" :key="name">
          <button type="button" class="setup-step" :class="{ 'is-current': name === step, 'is-past': i < index }"
            :aria-current="name === step ? 'step' : null" @click="$emit('step', name)">
            <AppIcon :name="STEP_ICONS[name]" />
            <span>{{ t('setup.steps.' + name) }}</span>
          </button>
        </li>
      </ol>
      <p class="small muted">{{ t('setup.stepOf', { n: index + 1, total: SETUP_STEPS.length }) }}</p>

      <!-- 1 Place on map -->
      <template v-if="step === 'place'">
        <p>{{ t('setup.place.text') }}</p>
        <LocationBar v-if="online" in-setup :has-location="Boolean(garden.location)"
          @fly="$emit('fly', $event)" @confirm="$emit('confirm-location')" @cancel="$emit('skip-location')" @remove="$emit('remove-location')" />
        <p v-else class="field-hint">{{ t('map.background.offline') }}. {{ t('setup.place.offline') }}</p>
      </template>

      <!-- 2 Boundary -->
      <template v-else-if="step === 'boundary'">
        <p>{{ t(garden.location ? 'setup.boundary.textMap' : 'setup.boundary.textGrid') }}</p>
        <template v-if="parcel">
          <p class="setup-result"><AppIcon name="check" /><span>{{ t('setup.boundary.drawn', { area: parcelArea }) }}</span></p>
          <div class="btn-row">
            <button type="button" class="btn btn-secondary" @click="$emit('select', parcel.id)">
              <AppIcon name="edit" /><span>{{ t('setup.boundary.edit') }}</span>
            </button>
            <button type="button" class="btn btn-text" @click="$emit('redraw-parcel')">
              <AppIcon name="redo" /><span>{{ t('setup.boundary.redraw') }}</span>
            </button>
          </div>
        </template>
        <div v-else class="btn-row">
          <button type="button" class="btn btn-secondary" :aria-pressed="isActive('parcel', 'rectangle') ? 'true' : 'false'" @click="$emit('draw', { type: 'parcel', draw: 'rectangle' })">
            <AppIcon name="rectangle" /><span>{{ t('setup.boundary.rectangle') }}</span>
          </button>
          <button type="button" class="btn btn-secondary" :aria-pressed="isActive('parcel', 'polygon') ? 'true' : 'false'" @click="$emit('draw', { type: 'parcel', draw: 'polygon' })">
            <AppIcon name="polygon" /><span>{{ t('setup.boundary.freeShape') }}</span>
          </button>
          <button type="button" class="btn btn-text" @click="$emit('add-by-size', 'parcel')">
            <AppIcon name="ruler" /><span>{{ t('setup.bySize') }}</span>
          </button>
        </div>
      </template>

      <!-- 3 Structures -->
      <template v-else-if="step === 'structures'">
        <p>{{ t('setup.structures.text') }}</p>
        <div class="setup-tools" role="group" :aria-label="t('setup.steps.structures')">
          <button v-for="type in STRUCTURE_TYPES" :key="type" type="button" class="setup-tool"
            :aria-pressed="isActive(type) ? 'true' : 'false'" @click="$emit('draw', { type })">
            <AppIcon :name="TYPE_ICONS[type]" />
            <span>{{ toolLabel(type) }}</span>
          </button>
        </div>
        <p class="field-hint">{{ t('setup.structures.treeHint') }}</p>
        <div class="btn-row">
          <button type="button" class="btn btn-text" @click="$emit('add-by-size', 'building')">
            <AppIcon name="ruler" /><span>{{ t('setup.bySize') }}</span>
          </button>
        </div>
        <template v-if="structures.length">
          <h3 class="small">{{ t('setup.structures.drawn', { count: structures.length }, structures.length) }}</h3>
          <ul class="plain-list">
            <li v-for="element in structures" :key="element.id">
              <button type="button" class="menu-item element-row" @click="$emit('select', element.id)">
                <AppIcon :name="TYPE_ICONS[element.type]" />
                <span class="element-row-name">{{ name(element) }}</span>
                <span class="muted small">{{ summary(element) }}</span>
              </button>
            </li>
          </ul>
        </template>
      </template>

      <!-- 4 Beds -->
      <template v-else-if="step === 'beds'">
        <p>{{ t('setup.beds.text') }}</p>
        <div class="btn-row">
          <button type="button" class="btn btn-secondary" :aria-pressed="isActive('bed', 'rectangle') ? 'true' : 'false'" @click="$emit('draw', { type: 'bed', draw: 'rectangle' })">
            <AppIcon name="rectangle" /><span>{{ t('setup.boundary.rectangle') }}</span>
          </button>
          <button type="button" class="btn btn-secondary" :aria-pressed="isActive('bed', 'polygon') ? 'true' : 'false'" @click="$emit('draw', { type: 'bed', draw: 'polygon' })">
            <AppIcon name="polygon" /><span>{{ t('setup.boundary.freeShape') }}</span>
          </button>
          <button type="button" class="btn btn-text" @click="$emit('add-by-size', 'bed')">
            <AppIcon name="ruler" /><span>{{ t('setup.bySize') }}</span>
          </button>
        </div>
        <template v-if="beds.length">
          <h3 class="small">{{ t('setup.beds.drawn', { count: beds.length }, beds.length) }}</h3>
          <ul class="plain-list">
            <li v-for="element in beds" :key="element.id">
              <button type="button" class="menu-item element-row" @click="$emit('select', element.id)">
                <AppIcon :name="TYPE_ICONS.bed" />
                <span class="element-row-name">{{ name(element) }}</span>
                <span class="muted small">{{ summary(element) }}</span>
              </button>
            </li>
          </ul>
        </template>
        <p class="field-hint">{{ t('setup.beds.next') }}</p>
      </template>

      <!-- 5 Climate -->
      <template v-else-if="step === 'climate'">
        <p>{{ t('setup.climate.text') }}</p>
        <ClimateSettings bare />
      </template>

      <div v-if="step !== 'place' || !online" class="dialog-actions setup-actions">
        <button v-if="index > 0" type="button" class="btn btn-text" @click="go(-1)">
          <AppIcon name="chevron-left" /><span>{{ t('setup.back') }}</span>
        </button>
        <button v-if="step === 'climate'" type="button" class="btn btn-primary" @click="$emit('finish')">
          <AppIcon name="check" /><span>{{ t('setup.finish') }}</span>
        </button>
        <button v-else-if="hasContent && step !== 'place'" type="button" class="btn btn-primary" @click="go(1)">
          <span>{{ t('setup.next') }}</span><AppIcon name="chevron-right" />
        </button>
        <button v-else type="button" class="btn btn-secondary" @click="go(1)">
          <span>{{ t('setup.skip') }}</span><AppIcon name="chevron-right" />
        </button>
      </div>
      <button type="button" class="btn btn-text setup-close" @click="$emit('close')">{{ t('setup.close') }}</button>
    </section>
  `,
};
