// Plant catalog (docs/concept.md §5).
//
// Milestone 3 ships a first set of plants with the fields that beds and plantings
// need. Ids are final, so milestone 4 extends these entries (windows, care,
// companions, icons) without a data migration. Names live in the message
// modules under plants.<id>.
//
// placement: where the plant goes – 'bed' (planting in a bed), 'tree' or 'shrub'
// (element on the map). spacing in metres: row = between rows, plant = in the row.
// growDays: typical time from planting to the end of harvest, used to propose
// an end date. null for perennials, which stay until removed.

export const PLANTS = [
  { id: 'carrot', category: 'vegetable', family: 'apiaceae', placement: 'bed', lifecycle: 'annual', color: '#F28C28', spacing: { row: 0.25, plant: 0.05 }, growDays: 120 },
  { id: 'tomato', category: 'vegetable', family: 'solanaceae', placement: 'bed', lifecycle: 'annual', color: '#E5483A', spacing: { row: 0.8, plant: 0.6 }, growDays: 140 },
  { id: 'lettuce', category: 'vegetable', family: 'asteraceae', placement: 'bed', lifecycle: 'annual', color: '#7BC47F', spacing: { row: 0.3, plant: 0.3 }, growDays: 60 },
  { id: 'radish', category: 'vegetable', family: 'brassicaceae', placement: 'bed', lifecycle: 'annual', color: '#E0457B', spacing: { row: 0.15, plant: 0.03 }, growDays: 30 },
  { id: 'bushBean', category: 'vegetable', family: 'fabaceae', placement: 'bed', lifecycle: 'annual', color: '#8DB33A', spacing: { row: 0.4, plant: 0.1 }, growDays: 90 },
  { id: 'potato', category: 'vegetable', family: 'solanaceae', placement: 'bed', lifecycle: 'annual', color: '#C9A15B', spacing: { row: 0.7, plant: 0.35 }, growDays: 120 },
  { id: 'zucchini', category: 'vegetable', family: 'cucurbitaceae', placement: 'bed', lifecycle: 'annual', color: '#4E9A4A', spacing: { row: 1, plant: 1 }, growDays: 120 },
  { id: 'onion', category: 'vegetable', family: 'amaryllidaceae', placement: 'bed', lifecycle: 'annual', color: '#9B59B6', spacing: { row: 0.25, plant: 0.1 }, growDays: 140 },
  { id: 'basil', category: 'herb', family: 'lamiaceae', placement: 'bed', lifecycle: 'annual', color: '#3E8E41', spacing: { row: 0.25, plant: 0.25 }, growDays: 100 },
  { id: 'parsley', category: 'herb', family: 'apiaceae', placement: 'bed', lifecycle: 'biennial', color: '#5BAE5B', spacing: { row: 0.25, plant: 0.15 }, growDays: 150 },
  { id: 'strawberry', category: 'berry', family: 'rosaceae', placement: 'bed', lifecycle: 'perennial', color: '#D7263D', spacing: { row: 0.6, plant: 0.3 }, growDays: null },
  { id: 'apple', category: 'fruitTree', family: 'rosaceae', placement: 'tree', lifecycle: 'perennial', color: '#8BBF3F', spacing: { row: 4, plant: 4 }, growDays: null },
  { id: 'cherry', category: 'fruitTree', family: 'rosaceae', placement: 'tree', lifecycle: 'perennial', color: '#A31F48', spacing: { row: 5, plant: 5 }, growDays: null },
  { id: 'redcurrant', category: 'berry', family: 'grossulariaceae', placement: 'shrub', lifecycle: 'perennial', color: '#C62F3B', spacing: { row: 1.5, plant: 1.2 }, growDays: null },
  { id: 'raspberry', category: 'berry', family: 'rosaceae', placement: 'shrub', lifecycle: 'perennial', color: '#B0306A', spacing: { row: 1.5, plant: 0.5 }, growDays: null },
];

const byId = new Map(PLANTS.map((plant) => [plant.id, plant]));

/** Used for unknown ids (e.g. data from a newer catalog). */
export const UNKNOWN_PLANT = Object.freeze({
  id: 'unknown', category: 'vegetable', family: null, placement: 'bed', lifecycle: 'annual',
  color: '#8C8471', spacing: { row: 0.3, plant: 0.3 }, growDays: 90,
});

export function getPlant(id) {
  return byId.get(id) ?? UNKNOWN_PLANT;
}

export function isKnownPlant(id) {
  return byId.has(id);
}

export function plantsFor(placement) {
  return PLANTS.filter((plant) => plant.placement === placement);
}
