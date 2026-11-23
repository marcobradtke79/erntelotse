// The season shown by the Gantt charts: 13 weeks from the week shown on the map and bed
// timelines. One position in time for the whole app: stepping the season moves that week.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { period, setWeek, thisWeek, currentYear } from '../stores/period.js';
import { isoWeekMonday } from '../logic/climate.js';
import { addDays } from '../logic/dates.js';
import { seasonRange } from '../logic/gantt.js';

export function useSeason() {
  const { locale } = useI18n();
  // "Whole year" on the map: start with this week, in other years with their first week
  const seasonStart = computed(() => period.day ?? (period.year === currentYear() ? thisWeek() : isoWeekMonday(period.year, 1)));
  const season = computed(() => seasonRange(seasonStart.value));
  const seasonTitle = computed(() => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .formatRange(new Date(`${season.value.from}T00:00:00Z`), new Date(`${season.value.to}T00:00:00Z`)));
  const moveSeason = (weeks) => setWeek(addDays(seasonStart.value, weeks * 7));
  const isThisWeek = computed(() => seasonStart.value === thisWeek());
  return { season, seasonTitle, moveSeason, isThisWeek };
}
