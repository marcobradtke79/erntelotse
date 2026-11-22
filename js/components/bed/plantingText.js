// Display helpers for plantings: plant name, period, status.

import { plantNameById } from '../../stores/catalog.js';

export function plantName(plantId, t) {
  return plantNameById(plantId, t);
}

function formatDay(iso, locale, withYear) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** "1 Apr – 31 May", with years when they differ from `year`; open end: "since 1 Apr 2024" */
export function periodText(planting, locale, t, year) {
  const startYear = Number(planting.start.slice(0, 4));
  if (planting.end === null) return t('planting.since', { date: formatDay(planting.start, locale, startYear !== year) });
  const endYear = Number(planting.end.slice(0, 4));
  const showYears = startYear !== year || endYear !== year;
  return `${formatDay(planting.start, locale, showYears)} – ${formatDay(planting.end, locale, showYears)}`;
}
