// Weather notes for the garden (docs/concept.md §6.5). Pure module.
//
// days: [{ date, tMin, tMax, rain }] (°C, mm), a few past days and the next week.
// Notes: { kind: 'frost', date, tMin, plantIds }  – frost-tender plants out or about to go out
//        { kind: 'water', hotDays }               – dry, warm spell ahead
//        { kind: 'rained', mm }                   – enough rain lately, no watering needed

import { addDays } from './dates.js';
import { isActiveOn } from './plantings.js';

export const FROST_THRESHOLD = 1; // °C: ground frost is possible from here
export const HOT_DAY = 25; // °C
export const ENOUGH_RAIN = 10; // mm over the last three days
export const PLANTING_SOON_DAYS = 14;

const sum = (list) => list.reduce((total, value) => total + (value ?? 0), 0);

export function weatherNotes({ days, garden, catalog, today }) {
  const notes = [];
  const future = days.filter((day) => day.date >= today).slice(0, 7);
  const past = days.filter((day) => day.date < today).slice(-3);

  // Frost: frost-tender plants that are out, or will be planted soon after the frost
  const frostDay = future.find((day) => day.tMin !== null && day.tMin <= FROST_THRESHOLD);
  if (frostDay) {
    const soon = addDays(frostDay.date, PLANTING_SOON_DAYS);
    const tender = garden.plantings
      .filter((planting) => catalog.get(planting.plantId).frostTender)
      .filter((planting) => isActiveOn(planting, frostDay.date) || (planting.start > today && planting.start <= soon))
      .map((planting) => planting.plantId);
    const tenderElements = garden.elements
      .filter((element) => element.plantId && catalog.has(element.plantId) && catalog.get(element.plantId).frostTender)
      .map((element) => element.plantId);
    const plantIds = [...new Set([...tender, ...tenderElements])];
    if (plantIds.length) notes.push({ kind: 'frost', date: frostDay.date, tMin: frostDay.tMin, plantIds });
  }

  // Watering: only relevant while something grows
  const growing = garden.plantings.some((planting) => isActiveOn(planting, today));
  if (growing) {
    const recentRain = sum(past.map((day) => day.rain));
    const next = future.slice(0, 3);
    if (recentRain >= ENOUGH_RAIN) {
      notes.push({ kind: 'rained', mm: recentRain });
    } else {
      const hotDays = next.filter((day) => day.tMax !== null && day.tMax >= HOT_DAY).length;
      if (hotDays >= 2 && recentRain + sum(next.map((day) => day.rain)) < 2) notes.push({ kind: 'water', hotDays });
    }
  }
  return notes;
}

/** Open-Meteo daily response → days. */
export function parseForecast(data) {
  const daily = data?.daily;
  if (!daily || !Array.isArray(daily.time)) throw new Error('Unexpected forecast format');
  return daily.time.map((date, i) => ({
    date,
    tMin: daily.temperature_2m_min?.[i] ?? null,
    tMax: daily.temperature_2m_max?.[i] ?? null,
    rain: daily.precipitation_sum?.[i] ?? null,
  }));
}
