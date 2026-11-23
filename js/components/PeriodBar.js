// Timeline of the map and the bed editor: the shown week within the year, moved week by
// week (buttons, slider, arrow keys), or the whole year. With `plantings` it also shows
// how many of them are in the ground in each week, so changes over the year stand out.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { period, setWeek, showThisWeek, thisWeek, currentYear } from '../stores/period.js';
import { addDays } from '../logic/dates.js';
import { isoWeekOf, isoWeekMonday, isoWeeksInYear } from '../logic/climate.js';
import { weekCounts } from '../logic/plantings.js';
import AppIcon from './AppIcon.js';

export default {
  name: 'PeriodBar',
  components: { AppIcon },
  props: {
    /** Plantings counted per week (the garden's or a bed's); null hides the strip */
    plantings: { type: Array, default: null },
  },
  setup(props) {
    const { t, locale } = useI18n();
    const utc = (iso) => new Date(`${iso}T00:00:00Z`);
    const rangeFormat = computed(() => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }));

    const weeks = computed(() => isoWeeksInYear(period.year));
    const mondays = computed(() => Array.from({ length: weeks.value }, (_, index) => isoWeekMonday(period.year, index + 1)));
    const week = computed(() => (period.day ? isoWeekOf(period.day).week : null));
    const label = computed(() => (period.day
      ? t('period.week', { week: week.value, range: rangeFormat.value.formatRange(utc(period.day), utc(addDays(period.day, 6))) })
      : t('period.wholeYear', { year: period.year })));
    const isThisWeek = computed(() => period.day === thisWeek());
    const sliderValue = computed(() => week.value ?? (period.year === currentYear() ? isoWeekOf(thisWeek()).week : 1));

    const months = computed(() => {
      const format = new Intl.DateTimeFormat(locale.value, { month: 'narrow', timeZone: 'UTC' });
      return Array.from({ length: 12 }, (_, month) => ({
        label: format.format(new Date(Date.UTC(period.year, month, 1))),
        days: new Date(Date.UTC(period.year, month + 1, 0)).getUTCDate(),
      }));
    });

    /** Height of each week's column, relative to the fullest week */
    const strip = computed(() => {
      if (!props.plantings?.length) return null;
      const counts = weekCounts(props.plantings, mondays.value);
      const max = Math.max(...counts);
      if (max === 0) return null;
      return counts.map((count) => (count ? `${Math.max(15, Math.round((count / max) * 100))}%` : '0'));
    });

    function onSlide(event) {
      setWeek(addDays(isoWeekMonday(period.year, Number(event.target.value)), 3));
    }

    /** Steps across the turn of the year into the neighbouring year */
    function step(weeksBy) {
      if (period.day) setWeek(addDays(period.day, 7 * weeksBy));
    }

    function toggleWholeYear(event) {
      if (event.target.checked) setWeek(null);
      else if (period.year === currentYear()) showThisWeek();
      else setWeek(addDays(isoWeekMonday(period.year, 23), 3));
    }

    return { t, period, weeks, week, label, isThisWeek, sliderValue, months, strip, onSlide, step, toggleWholeYear, showThisWeek };
  },
  template: `
    <section class="period-bar" :aria-label="t('period.label')">
      <div class="period-bar-row">
        <button type="button" class="btn btn-icon" :title="t('period.previousWeek')" :disabled="!period.day" @click="step(-1)">
          <AppIcon name="chevron-left" :label="t('period.previousWeek')" />
        </button>
        <strong class="period-bar-label" aria-live="polite">{{ label }}</strong>
        <button type="button" class="btn btn-icon" :title="t('period.nextWeek')" :disabled="!period.day" @click="step(1)">
          <AppIcon name="chevron-right" :label="t('period.nextWeek')" />
        </button>
      </div>
      <div class="period-track">
        <div class="timeline-months" aria-hidden="true">
          <span v-for="(month, index) in months" :key="index" :style="{ flexGrow: month.days }">{{ month.label }}</span>
        </div>
        <div v-if="strip" class="period-strip" aria-hidden="true">
          <span v-for="(height, index) in strip" :key="index" :class="{ 'is-current': index + 1 === week }"><i :style="{ height }"></i></span>
        </div>
        <input
          class="period-slider"
          type="range"
          min="1"
          :max="weeks"
          step="1"
          :value="sliderValue"
          :disabled="!period.day"
          :aria-label="t('period.day')"
          :aria-valuetext="label"
          @input="onSlide"
        />
      </div>
      <div class="period-bar-row">
        <label class="period-whole-year">
          <input type="checkbox" :checked="!period.day" @change="toggleWholeYear" />
          <span>{{ t('period.showWholeYear') }}</span>
        </label>
        <button v-if="!isThisWeek" type="button" class="btn btn-text period-today" @click="showThisWeek">{{ t('period.today') }}</button>
      </div>
    </section>
  `,
};
