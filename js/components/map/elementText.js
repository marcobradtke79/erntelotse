// Display texts for elements (name fallback, size summary).

import { measure } from '../../logic/elements.js';
import { formatArea, formatLength } from '../../logic/units.js';

export function elementName(element, t) {
  return element.name || t(`elements.types.${element.type}`);
}

/** "4.8 m²", "Ø 4 m" or "12.5 m" */
export function elementSummary(element, units, locale) {
  const result = measure(element);
  if (element.geometry.kind === 'circle') return `Ø ${formatLength(result.diameter, units, locale)}`;
  if (element.geometry.kind === 'line') return formatLength(result.length, units, locale);
  return formatArea(result.area, units, locale);
}
