// Plant catalog (docs/concept.md §5).
//
// Names and hint texts live in the message modules: plants.<id> and careHints.<id>.<hint>.
// Dates are ISO calendar weeks for Central Europe (last frost around mid May, week 20);
// js/logic/climate.js shifts them for the garden's climate.
//
// placement   'bed' (planting in a bed), 'tree' or 'shrub' (element on the map)
// category    vegetable | herb | berry | fruitTree | shrub
// lifecycle   annual | biennial | perennial
// feeder      heavy | medium | light | fixer (nitrogen-fixing legumes)
// spacing     metres: row = between rows, plant = in the row
// growDays    proposed time in the bed for a new planting; null for perennials
// harvestDays how long the harvest of one planting lasts (before its end date)
// windows     { sowIndoor, sowOutdoor, plantOut, harvest }: lists of [fromWeek, toWeek]
// care        [{ type: care | fertilize | prune | water, weeks: [from, to], everyWeeks?, hint }]
// companions  { good: [ids], bad: [ids] } – kept symmetric (tested)

export const PLANTS = [
  {
    id: 'carrot', category: 'vegetable', family: 'apiaceae', placement: 'bed', lifecycle: 'annual', color: '#F28C28',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 4,
    spacing: { row: 0.25, plant: 0.05 }, growDays: 120, harvestDays: 60,
    windows: { sowIndoor: [], sowOutdoor: [[12, 26]], plantOut: [], harvest: [[26, 44]] },
    care: [{ type: 'water', weeks: [18, 30], hint: 'water' }],
    companions: { good: ['onion', 'radish', 'lettuce', 'tomato'], bad: [] },
  },
  {
    id: 'tomato', category: 'vegetable', family: 'solanaceae', placement: 'bed', lifecycle: 'annual', color: '#E5483A',
    feeder: 'heavy', frostTender: true, water: 'high', rotationGapYears: 3,
    spacing: { row: 0.8, plant: 0.6 }, growDays: 140, harvestDays: 70,
    windows: { sowIndoor: [[10, 14]], sowOutdoor: [], plantOut: [[20, 23]], harvest: [[29, 41]] },
    care: [
      { type: 'prune', weeks: [24, 36], everyWeeks: 1, hint: 'sideShoots' },
      { type: 'fertilize', weeks: [24, 34], everyWeeks: 2, hint: 'fertilize' },
      { type: 'water', weeks: [22, 38], hint: 'water' },
    ],
    companions: { good: ['basil', 'carrot', 'parsley', 'lettuce', 'onion', 'radish'], bad: ['potato'] },
  },
  {
    id: 'lettuce', category: 'vegetable', family: 'asteraceae', placement: 'bed', lifecycle: 'annual', color: '#7BC47F',
    feeder: 'light', frostTender: false, water: 'medium', rotationGapYears: 2,
    spacing: { row: 0.3, plant: 0.3 }, growDays: 60, harvestDays: 21,
    windows: { sowIndoor: [[9, 28]], sowOutdoor: [[13, 32]], plantOut: [[14, 34]], harvest: [[20, 42]] },
    care: [{ type: 'water', weeks: [18, 34], hint: 'water' }],
    companions: { good: ['carrot', 'radish', 'onion', 'strawberry', 'tomato', 'bushBean'], bad: [] },
  },
  {
    id: 'radish', category: 'vegetable', family: 'brassicaceae', placement: 'bed', lifecycle: 'annual', color: '#E0457B',
    feeder: 'light', frostTender: false, water: 'medium', rotationGapYears: 3,
    spacing: { row: 0.15, plant: 0.03 }, growDays: 30, harvestDays: 10,
    windows: { sowIndoor: [], sowOutdoor: [[11, 22], [32, 38]], plantOut: [], harvest: [[16, 26], [36, 43]] },
    care: [{ type: 'water', weeks: [14, 24], hint: 'water' }],
    companions: { good: ['carrot', 'lettuce', 'bushBean', 'tomato'], bad: [] },
  },
  {
    id: 'bushBean', category: 'vegetable', family: 'fabaceae', placement: 'bed', lifecycle: 'annual', color: '#8DB33A',
    feeder: 'fixer', frostTender: true, water: 'medium', rotationGapYears: 3,
    spacing: { row: 0.4, plant: 0.1 }, growDays: 90, harvestDays: 30,
    windows: { sowIndoor: [], sowOutdoor: [[20, 27]], plantOut: [], harvest: [[28, 38]] },
    care: [{ type: 'water', weeks: [26, 34], hint: 'water' }],
    companions: { good: ['potato', 'radish', 'lettuce', 'strawberry', 'zucchini'], bad: ['onion'] },
  },
  {
    id: 'potato', category: 'vegetable', family: 'solanaceae', placement: 'bed', lifecycle: 'annual', color: '#C9A15B',
    feeder: 'heavy', frostTender: true, water: 'medium', rotationGapYears: 4,
    spacing: { row: 0.7, plant: 0.35 }, growDays: 120, harvestDays: 30,
    windows: { sowIndoor: [], sowOutdoor: [], plantOut: [[15, 19]], harvest: [[26, 40]] },
    care: [{ type: 'care', weeks: [19, 24], hint: 'earthUp' }],
    companions: { good: ['bushBean'], bad: ['tomato', 'zucchini'] },
  },
  {
    id: 'zucchini', category: 'vegetable', family: 'cucurbitaceae', placement: 'bed', lifecycle: 'annual', color: '#4E9A4A',
    feeder: 'heavy', frostTender: true, water: 'high', rotationGapYears: 3,
    spacing: { row: 1, plant: 1 }, growDays: 120, harvestDays: 70,
    windows: { sowIndoor: [[15, 18]], sowOutdoor: [[20, 23]], plantOut: [[20, 23]], harvest: [[27, 40]] },
    care: [
      { type: 'fertilize', weeks: [24, 32], everyWeeks: 3, hint: 'fertilize' },
      { type: 'water', weeks: [22, 36], hint: 'water' },
    ],
    companions: { good: ['bushBean', 'onion'], bad: ['potato'] },
  },
  {
    id: 'onion', category: 'vegetable', family: 'amaryllidaceae', placement: 'bed', lifecycle: 'annual', color: '#9B59B6',
    feeder: 'light', frostTender: false, water: 'low', rotationGapYears: 4,
    spacing: { row: 0.25, plant: 0.1 }, growDays: 140, harvestDays: 21,
    windows: { sowIndoor: [], sowOutdoor: [[11, 15]], plantOut: [[12, 16]], harvest: [[30, 36]] },
    care: [{ type: 'water', weeks: [28, 31], hint: 'stopWatering' }],
    companions: { good: ['carrot', 'strawberry', 'lettuce', 'tomato', 'zucchini'], bad: ['bushBean'] },
  },
  {
    id: 'basil', category: 'herb', family: 'lamiaceae', placement: 'bed', lifecycle: 'annual', color: '#3E8E41',
    feeder: 'medium', frostTender: true, water: 'medium', rotationGapYears: 2,
    spacing: { row: 0.25, plant: 0.25 }, growDays: 100, harvestDays: 70,
    windows: { sowIndoor: [[13, 18]], sowOutdoor: [], plantOut: [[20, 24]], harvest: [[25, 40]] },
    care: [{ type: 'prune', weeks: [24, 38], everyWeeks: 2, hint: 'pinch' }],
    companions: { good: ['tomato'], bad: [] },
  },
  {
    id: 'parsley', category: 'herb', family: 'apiaceae', placement: 'bed', lifecycle: 'biennial', color: '#5BAE5B',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 4,
    spacing: { row: 0.25, plant: 0.15 }, growDays: 150, harvestDays: 100,
    windows: { sowIndoor: [], sowOutdoor: [[13, 30]], plantOut: [], harvest: [[22, 44]] },
    care: [{ type: 'water', weeks: [16, 22], hint: 'germination' }],
    companions: { good: ['tomato'], bad: [] },
  },
  {
    id: 'strawberry', category: 'berry', family: 'rosaceae', placement: 'bed', lifecycle: 'perennial', color: '#D7263D',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 4,
    spacing: { row: 0.6, plant: 0.3 }, growDays: null, harvestDays: 35,
    windows: { sowIndoor: [], sowOutdoor: [], plantOut: [[30, 36]], harvest: [[23, 28]] },
    care: [
      { type: 'care', weeks: [18, 20], hint: 'mulch' },
      { type: 'prune', weeks: [29, 32], hint: 'runners' },
      { type: 'fertilize', weeks: [30, 32], hint: 'fertilize' },
    ],
    companions: { good: ['onion', 'lettuce', 'bushBean'], bad: [] },
  },
  {
    id: 'apple', category: 'fruitTree', family: 'rosaceae', placement: 'tree', lifecycle: 'perennial', color: '#8BBF3F',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 4, plant: 4 }, growDays: null, harvestDays: 60,
    windows: { sowIndoor: [], sowOutdoor: [], plantOut: [[43, 48]], harvest: [[33, 42]] },
    care: [
      { type: 'prune', weeks: [6, 10], hint: 'winterPruning' },
      { type: 'fertilize', weeks: [12, 15], hint: 'fertilize' },
      { type: 'care', weeks: [25, 28], hint: 'thinFruit' },
    ],
    companions: { good: [], bad: [] },
  },
  {
    id: 'cherry', category: 'fruitTree', family: 'rosaceae', placement: 'tree', lifecycle: 'perennial', color: '#A31F48',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 5, plant: 5 }, growDays: null, harvestDays: 30,
    windows: { sowIndoor: [], sowOutdoor: [], plantOut: [[43, 48]], harvest: [[25, 30]] },
    care: [
      { type: 'fertilize', weeks: [12, 15], hint: 'fertilize' },
      { type: 'prune', weeks: [30, 34], hint: 'summerPruning' },
    ],
    companions: { good: [], bad: [] },
  },
  {
    id: 'redcurrant', category: 'berry', family: 'grossulariaceae', placement: 'shrub', lifecycle: 'perennial', color: '#C62F3B',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 1.5, plant: 1.2 }, growDays: null, harvestDays: 30,
    windows: { sowIndoor: [], sowOutdoor: [], plantOut: [[42, 47]], harvest: [[26, 30]] },
    care: [
      { type: 'prune', weeks: [6, 10], hint: 'pruning' },
      { type: 'fertilize', weeks: [12, 15], hint: 'fertilize' },
    ],
    companions: { good: [], bad: [] },
  },
  {
    id: 'raspberry', category: 'berry', family: 'rosaceae', placement: 'shrub', lifecycle: 'perennial', color: '#B0306A',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 1.5, plant: 0.5 }, growDays: null, harvestDays: 40,
    windows: { sowIndoor: [], sowOutdoor: [], plantOut: [[42, 47]], harvest: [[26, 32]] },
    care: [
      { type: 'care', weeks: [12, 16], hint: 'mulch' },
      { type: 'prune', weeks: [32, 36], hint: 'cutCanes' },
    ],
    companions: { good: [], bad: [] },
  },
];

const byId = new Map(PLANTS.map((plant) => [plant.id, plant]));

/** Used for unknown ids (e.g. data from a newer catalog or a deleted custom plant). */
export const UNKNOWN_PLANT = Object.freeze({
  id: 'unknown', category: 'vegetable', family: null, placement: 'bed', lifecycle: 'annual',
  color: '#8C8471', feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
  spacing: { row: 0.3, plant: 0.3 }, growDays: 90, harvestDays: 14,
  windows: { sowIndoor: [], sowOutdoor: [], plantOut: [], harvest: [] },
  care: [],
  companions: { good: [], bad: [] },
});

/** Built-in plants only. Code that should see custom plants uses the catalog store. */
export function getPlant(id) {
  return byId.get(id) ?? UNKNOWN_PLANT;
}

export function isKnownPlant(id) {
  return byId.has(id);
}

export function plantsFor(placement) {
  return PLANTS.filter((plant) => plant.placement === placement);
}
