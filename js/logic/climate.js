// Climate adjustment of catalog windows (docs/concept.md §6.2). Pure module.
//
// Catalog windows are ISO calendar weeks for Central Europe (last frost around
// mid May, week 20). A garden's climate is { hemisphere, shiftWeeks }:
// - shiftWeeks > 0: colder – spring work later, autumn work earlier (season shrinks)
// - shiftWeeks < 0: milder – spring earlier, autumn later (season stretches)
// - southern hemisphere: everything half a year later.

import { addDays, toIsoDate, dayOfYear, yearOf } from './dates.js';

export const REFERENCE_LAST_FROST = '05-15';
export const MAX_SHIFT = 8;
export const PRESETS = { mild: -2, average: 0, cold: 2 };
const MID_YEAR_WEEK = 26;

/** Monday of ISO week `week` of `year`; weeks beyond the year continue into the next. */
export function isoWeekMonday(year, week) {
  const january4 = toIsoDate(year, 1, 4);
  const weekday = (new Date(`${january4}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(january4, -weekday + (week - 1) * 7);
}

/** ISO week number and its year of a date. */
export function isoWeekOf(iso) {
  // The Thursday of a week decides its year; week 1 contains 4 January
  const thursday = new Date(`${iso}T00:00:00Z`);
  thursday.setUTCDate(thursday.getUTCDate() - ((thursday.getUTCDay() + 6) % 7) + 3);
  const weekYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);
  return { year: weekYear, week: 1 + Math.round((thursday - firstThursday) / (7 * 86400000)) };
}

/** Shifts one window boundary by the garden's climate. */
export function shiftWeek(week, climate) {
  const shift = climate?.shiftWeeks ?? 0;
  let shifted = week <= MID_YEAR_WEEK ? week + shift : week - shift;
  if (climate?.hemisphere === 'south') shifted += 26;
  return shifted;
}

/**
 * Dates of a catalog window [fromWeek, toWeek] in `year` for a climate:
 * { start, end } as ISO dates (Monday of the first week to Sunday of the last).
 */
export function windowDates([fromWeek, toWeek], year, climate) {
  let from = shiftWeek(fromWeek, climate);
  let to = shiftWeek(toWeek, climate);
  if (to < from) {
    // A cold climate can squeeze a short summer window to nothing; keep its middle week
    from = Math.round((from + to) / 2);
    to = from;
  }
  return { start: isoWeekMonday(year, from), end: addDays(isoWeekMonday(year, to), 6) };
}

/** All instances of a window that overlap [from, to] (ISO dates). */
export function windowInstances(window, climate, from, to) {
  const instances = [];
  for (let year = yearOf(from) - 1; year <= yearOf(to) + 1; year++) {
    const dates = windowDates(window, year, climate);
    if (dates.end >= from && dates.start <= to) instances.push(dates);
  }
  return instances;
}

/** Shift in weeks from the typical last frost date (MM-DD), clamped to ±MAX_SHIFT. */
export function shiftFromLastFrost(monthDay) {
  const year = 2025; // any common year
  const days = dayOfYear(`${year}-${monthDay}`) - dayOfYear(`${year}-${REFERENCE_LAST_FROST}`);
  return Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, Math.round(days / 7)));
}

/** Typical last frost (MM-DD) for a shift, the inverse of shiftFromLastFrost. */
export function lastFrostForShift(shiftWeeks) {
  return addDays(`2025-${REFERENCE_LAST_FROST}`, shiftWeeks * 7).slice(5);
}

/** 'mild' | 'average' | 'cold' | 'custom' */
export function presetOf(shiftWeeks) {
  return Object.keys(PRESETS).find((key) => PRESETS[key] === shiftWeeks) ?? 'custom';
}
