// The year and day shown in Map, Bed editor and Calendar (shared, not persisted).
// day: ISO date within `year`, or null for "the whole year".

import { reactive } from 'vue';
import { todayIso, yearOf, withYear } from '../logic/dates.js';

export const period = reactive({
  year: yearOf(todayIso()),
  day: todayIso(),
  /** year → true when the user allowed editing that past year in this session */
  unlocked: {},
});

export function currentYear() {
  return yearOf(todayIso());
}

/** Keeps the day of the year when switching years; the current year shows today. */
export function setYear(year) {
  period.year = year;
  if (year === currentYear()) period.day = todayIso();
  else if (period.day) period.day = withYear(period.day, year);
}

export function setDay(day) {
  period.day = day;
  if (day) period.year = yearOf(day);
}

export function showToday() {
  setDay(todayIso());
}

/** Past years are read-only until unlocked, to protect the history. */
export function isLocked(year = period.year) {
  return year < currentYear() && !period.unlocked[year];
}

export function unlockYear(year = period.year) {
  period.unlocked[year] = true;
}
