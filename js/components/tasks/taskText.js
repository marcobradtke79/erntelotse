// Display helpers for hints: icon, title, text, place, period.

import { plantById, plantLabel } from '../../stores/catalog.js';
import { elementName } from '../map/elementText.js';

export const TASK_ICONS = {
  sow: 'seed',
  plant: 'seedling',
  care: 'spade',
  fertilize: 'bag',
  prune: 'shears',
  water: 'watering-can',
  harvest: 'basket',
};

const GENERAL_HINTS = ['sowIndoor', 'sowOutdoor', 'plantOut', 'harvest'];

/** Short title: "Sow indoors", "Fertilize", … */
export function hintTitle(hint, t) {
  return GENERAL_HINTS.includes(hint.hint) ? t(`hints.text.${hint.hint}`) : t(`hints.types.${hint.type}`);
}

/** The catalog's advice for a care hint, or '' */
export function hintAdvice(hint, t, te) {
  if (GENERAL_HINTS.includes(hint.hint)) return '';
  const key = `careHints.${hint.plantId}.${hint.hint}`;
  return te(key) ? t(key) : '';
}

export function hintPlantName(hint, t) {
  return plantLabel(plantById(hint.plantId), t);
}

/** Where: the bed of a planting, or the tree/shrub itself. */
export function hintPlace(hint, garden, t) {
  const id = hint.sourceKind === 'planting' ? hint.bedId : hint.sourceId;
  const element = garden.elements.find((item) => item.id === id);
  return element ? elementName(element, t) : '';
}

const formatters = new Map();
function formatter(locale) {
  if (!formatters.has(locale)) formatters.set(locale, new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }));
  return formatters.get(locale);
}

export function shortDate(iso, locale) {
  return formatter(locale).format(new Date(`${iso}T00:00:00Z`));
}

/** "12 May" or "12 May – 3 Jun" */
export function hintPeriod(hint, locale) {
  const start = shortDate(hint.start, locale);
  return hint.start === hint.end ? start : `${start} – ${shortDate(hint.end, locale)}`;
}
