// Day within the selected year (slider) or the whole year; shown above map panels.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { period, setDay, showToday, currentYear } from '../stores/period.js';
import { dayOfYear, fromDayOfYear, daysInYear, todayIso, toIsoDate } from '../logic/dates.js';
import AppIcon from './AppIcon.js';

export default {
  name: 'PeriodBar',
  components: { AppIcon },
  setup() {
    const { t, locale } = useI18n();
    const format = computed(() => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }));
    const label = computed(() => (period.day
      ? format.value.format(new Date(`${period.day}T00:00:00Z`))
      : t('period.wholeYear', { year: period.year })));
    const dayValue = computed(() => (period.day ? dayOfYear(period.day) : dayOfYear(todayIso())));
    const days = computed(() => daysInYear(period.year));
    const isToday = computed(() => period.day === todayIso());

    function onSlide(event) {
      setDay(fromDayOfYear(period.year, Number(event.target.value)));
    }

    function toggleWholeYear(event) {
      if (event.target.checked) setDay(null);
      else if (period.year === currentYear()) showToday();
      else setDay(toIsoDate(period.year, 6, 1));
    }

    return { t, period, label, dayValue, days, isToday, onSlide, toggleWholeYear, showToday };
  },
  template: `
    <section class="period-bar" :aria-label="t('period.label')">
      <div class="period-bar-row">
        <AppIcon name="calendar" />
        <strong class="period-bar-label">{{ label }}</strong>
        <button v-if="!isToday" type="button" class="btn btn-text period-today" @click="showToday">{{ t('period.today') }}</button>
      </div>
      <input
        class="period-slider"
        type="range"
        min="1"
        :max="days"
        :value="dayValue"
        :disabled="!period.day"
        :aria-label="t('period.day')"
        :aria-valuetext="label"
        @input="onSlide"
      />
      <label class="period-whole-year">
        <input type="checkbox" :checked="!period.day" @change="toggleWholeYear" />
        <span>{{ t('period.showWholeYear') }}</span>
      </label>
    </section>
  `,
};
