// ‹ 2026 › in the header of Map, Bed editor and Calendar.

import { useI18n } from 'vue-i18n';
import { period, setYear } from '../stores/period.js';
import AppIcon from './AppIcon.js';

export default {
  name: 'YearSwitcher',
  components: { AppIcon },
  setup() {
    const { t } = useI18n();
    return { t, period, setYear };
  },
  template: `
    <div class="year-switcher" role="group" :aria-label="t('period.year')">
      <button type="button" class="btn btn-icon" :title="t('period.previousYear')" @click="setYear(period.year - 1)">
        <AppIcon name="chevron-left" :label="t('period.previousYear')" />
      </button>
      <span class="year-switcher-value" aria-live="polite">{{ period.year }}</span>
      <button type="button" class="btn btn-icon" :title="t('period.nextYear')" @click="setYear(period.year + 1)">
        <AppIcon name="chevron-right" :label="t('period.nextYear')" />
      </button>
    </div>
  `,
};
