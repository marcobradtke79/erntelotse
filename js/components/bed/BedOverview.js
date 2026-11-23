// The bed without a selected planting: add a planting, the year's timeline, the plantings
// of the shown period, copy to the next year, and the bed's history by year.

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { plantById as getPlant } from '../../stores/catalog.js';
import { visiblePlantings, plantingsOfBed, historyByYear, plantingStatus, plantCount, canCopyForward, touchesYear, isRaisedBetween } from '../../logic/plantings.js';
import { todayIso, yearOf, addDays } from '../../logic/dates.js';
import AppIcon from '../AppIcon.js';
import PlantIcon from '../PlantIcon.js';
import BedThumbnail from './BedThumbnail.js';
import BedTimeline from './BedTimeline.js';
import { plantName, periodText, preText } from './plantingText.js';

export default {
  name: 'BedOverview',
  components: { AppIcon, PlantIcon, BedThumbnail, BedTimeline },
  props: {
    bed: { type: Object, required: true },
    plantings: { type: Array, required: true },
    period: { type: Object, required: true },
    readOnly: { type: Boolean, default: false },
    /** plantingId → ['good' | 'bad' | 'rotation'] */
    badges: { type: Object, default: () => ({}) },
  },
  emits: ['select', 'year', 'copy', 'add'],
  setup(props, { emit }) {
    const { t, locale } = useI18n();
    const today = todayIso();
    const own = computed(() => plantingsOfBed(props.plantings, props.bed.id));
    const shown = computed(() => visiblePlantings(own.value, props.period).sort((a, b) => a.start.localeCompare(b.start)));
    /** Pre-cultivated in the shown week and not yet in the bed */
    const raised = computed(() => (props.period.day
      ? own.value.filter((planting) => isRaisedBetween(planting, props.period.day, addDays(props.period.day, (props.period.days ?? 1) - 1)))
        .sort((a, b) => a.start.localeCompare(b.start))
      : []));
    const pre = (planting) => preText(planting, locale.value, t);
    const heading = computed(() => (props.period.day ? t('bed.inWeek') : t('bed.inYear', { year: props.period.year })));

    // Copy forward: plantings that start in the shown year and have an end
    const copyable = computed(() => own.value.filter((planting) => yearOf(planting.start) === props.period.year && canCopyForward(planting)));
    const chosen = ref([]);
    watch(copyable, (list) => {
      chosen.value = list.map((planting) => planting.id);
    }, { immediate: true });
    const perennials = computed(() => own.value.filter((planting) => planting.end === null && touchesYear(planting, props.period.year)).length);

    const history = computed(() => historyByYear(props.plantings, props.bed.id, Math.max(props.period.year, yearOf(today))));

    const name = (planting) => plantName(planting.plantId, t);
    const color = (planting) => getPlant(planting.plantId).color;
    const when = (planting) => periodText(planting, locale.value, t, props.period.year);
    const status = (planting) => plantingStatus(planting, today);
    const count = (planting) => plantCount(planting, getPlant(planting.plantId));
    const plantNames = (list) => [...new Set(list.map(name))].join(', ');

    function copy() {
      if (chosen.value.length) emit('copy', [...chosen.value]);
    }

    const badgeIcons = { good: 'check', bad: 'close', rotation: 'alert' };

    return { t, badgeIcons, own, shown, raised, pre, heading, copyable, chosen, perennials, history, name, color, when, status, count, plantNames, copy };
  },
  template: `
    <section class="bed-overview">
      <button v-if="!readOnly" type="button" class="btn btn-primary bed-add" @click="$emit('add')">
        <AppIcon name="plus" />
        <span>{{ t('bed.add.button') }}</span>
      </button>
      <BedTimeline :plantings="own" :year="period.year" :day="period.day" :days="period.days" @select="$emit('select', $event)" />
      <h3>{{ heading }}</h3>
      <p v-if="shown.length === 0" class="muted small">{{ readOnly ? t('bed.emptyReadOnly') : t('bed.empty') }}</p>
      <ul v-else class="plain-list">
        <li v-for="planting in shown" :key="planting.id">
          <button type="button" class="menu-item planting-row" @click="$emit('select', planting.id)">
            <PlantIcon :plant-id="planting.plantId" :size="28" />
            <span class="planting-row-text">
              <span class="planting-row-name">{{ name(planting) }}</span>
              <span class="muted small">{{ when(planting) }} · {{ t('planting.plants', { count: count(planting) }, count(planting)) }}</span>
              <span v-if="planting.preStart" class="muted small">{{ pre(planting) }}</span>
            </span>
            <span v-for="badge in badges[planting.id] ?? []" :key="badge" class="badge-dot" :class="'is-' + badge" :title="t('rotation.badges.' + badge)">
              <AppIcon :name="badgeIcons[badge]" :label="t('rotation.badges.' + badge)" />
            </span>
            <span class="status-chip" :class="'is-' + status(planting)">{{ t('status.' + status(planting)) }}</span>
          </button>
        </li>
      </ul>

      <template v-if="raised.length">
        <h3>{{ t('bed.raising') }}</h3>
        <ul class="plain-list">
          <li v-for="planting in raised" :key="planting.id">
            <button type="button" class="menu-item planting-row" @click="$emit('select', planting.id)">
              <PlantIcon :plant-id="planting.plantId" :size="28" />
              <span class="planting-row-text">
                <span class="planting-row-name">{{ name(planting) }}</span>
                <span class="muted small">{{ pre(planting) }} · {{ when(planting) }}</span>
              </span>
              <span class="status-chip" :class="'is-' + status(planting)">{{ t('status.' + status(planting)) }}</span>
            </button>
          </li>
        </ul>
      </template>

      <details v-if="!readOnly && copyable.length" class="copy-forward">
        <summary>
          <AppIcon name="arrow-right" />
          <span>{{ t('bed.copyTitle', { year: period.year + 1 }) }}</span>
        </summary>
        <p class="small muted">{{ t('bed.copyHint') }}</p>
        <label v-for="planting in copyable" :key="planting.id" class="checkbox-row">
          <input type="checkbox" :value="planting.id" v-model="chosen" />
          <PlantIcon :plant-id="planting.plantId" :size="28" />
          <span>{{ name(planting) }} <span class="muted small">{{ when(planting) }}</span></span>
        </label>
        <p v-if="perennials" class="small muted">{{ t('bed.perennialsStay', { count: perennials }, perennials) }}</p>
        <button type="button" class="btn btn-secondary" :disabled="chosen.length === 0" @click="copy">
          {{ t('bed.copyButton', { count: chosen.length, year: period.year + 1 }, chosen.length) }}
        </button>
      </details>

      <h3 class="bed-history-title"><AppIcon name="history" />{{ t('bed.history') }}</h3>
      <p class="muted small">{{ history.length === 0 ? t('bed.historyEmpty') : t('bed.historyHint') }}</p>
      <ul v-if="history.length" class="plain-list bed-history">
        <li v-for="entry in history" :key="entry.year">
          <button type="button" class="menu-item history-row" :aria-current="entry.year === period.year ? 'true' : null" @click="$emit('year', entry.year)">
            <BedThumbnail :bed-points="bed.geometry.points" :plantings="entry.plantings" />
            <span class="planting-row-text">
              <strong>{{ entry.year }}</strong>
              <span class="small muted">{{ plantNames(entry.plantings) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </section>
  `,
};
