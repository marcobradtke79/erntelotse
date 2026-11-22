// Display texts for elements (name fallback, size summary).

import { measure } from '../../logic/elements.js';
import { formatArea, formatLength } from '../../logic/units.js';
import { isKnownPlant } from '../../data/plants.js';

/** The element's own name; for unnamed trees and shrubs the plant; else the type. */
export function elementName(element, t) {
  if (element.name) return element.name;
  if (element.plantId && isKnownPlant(element.plantId)) return t(`plants.${element.plantId}`);
  return t(`elements.types.${element.type}`);
}

/** "4.8 m²", "Ø 4 m" or "12.5 m" */
export function elementSummary(element, units, locale) {
  const result = measure(element);
  if (element.geometry.kind === 'circle') return `Ø ${formatLength(result.diameter, units, locale)}`;
  if (element.geometry.kind === 'line') return formatLength(result.length, units, locale);
  return formatArea(result.area, units, locale);
}
