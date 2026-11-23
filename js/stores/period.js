// The year and week shown in Map, Bed editor and Calendar (shared, not persisted).
// day: Monday (ISO date) of the shown week, or null for "the whole year".
// year: the year of that week (ISO week year: a week belongs to the year of its Thursday).

import { reactive } from 'vue';
import { todayIso, yearOf, mondayOf } from '../logic/dates.js';
import { isoWeekOf, isoWeekMonday, isoWeeksInYear } from '../logic/climate.js';

export const period = reactive({
  year: isoWeekOf(todayIso()).year,
  day: mondayOf(todayIso()),
  /** Length of the shown span in days: the timeline moves in weeks */
  days: 7,
  /** year → true when the user allowed editing that past year in this session */
  unlocked: {},
});

export function currentYear() {
  return yearOf(todayIso());
}

export function thisWeek() {
  return mondayOf(todayIso());
}

/** Shows the week that contains `date`; null shows the whole year. */
export function setWeek(date) {
  if (!date) {
    period.day = null;
    return;
  }
  period.day = mondayOf(date);
  period.year = isoWeekOf(period.day).year;
}

export function showThisWeek() {
  setWeek(todayIso());
}

/** Keeps the week of the year when switching years; the current year shows this week. */
export function setYear(year) {
  if (!period.day) {
    period.year = year;
    return;
  }
  if (year === isoWeekOf(todayIso()).year) {
    showThisWeek();
    return;
  }
  const week = Math.min(isoWeekOf(period.day).week, isoWeeksInYear(year));
  period.day = isoWeekMonday(year, week);
  period.year = year;
}

/** Past years are read-only until unlocked, to protect the history. */
export function isLocked(year = period.year) {
  return year < currentYear() && !period.unlocked[year];
}

export function unlockYear(year = period.year) {
  period.unlocked[year] = true;
}
