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
//             (ornamental shrubs have no harvest window)
// care        [{ type: care | fertilize | prune | water, weeks: [from, to], everyWeeks?, hint }]
// companions  built from GOOD_NEIGHBOURS / BAD_NEIGHBOURS below, so they are always symmetric

const none = [];
const w = (sowIndoor = none, sowOutdoor = none, plantOut = none, harvest = none) => ({ sowIndoor, sowOutdoor, plantOut, harvest });

const RAW_PLANTS = [
  // --- Vegetables ---------------------------------------------------------
  {
    id: 'carrot', category: 'vegetable', family: 'apiaceae', placement: 'bed', lifecycle: 'annual', color: '#F28C28',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 4,
    spacing: { row: 0.25, plant: 0.05 }, growDays: 120, harvestDays: 60,
    windows: w(none, [[12, 26]], none, [[26, 44]]),
    care: [{ type: 'water', weeks: [18, 30], hint: 'water' }],
  },
  {
    id: 'tomato', category: 'vegetable', family: 'solanaceae', placement: 'bed', lifecycle: 'annual', color: '#E5483A',
    feeder: 'heavy', frostTender: true, water: 'high', rotationGapYears: 3,
    spacing: { row: 0.8, plant: 0.6 }, growDays: 140, harvestDays: 70,
    windows: w([[10, 14]], none, [[20, 23]], [[29, 41]]),
    care: [
      { type: 'prune', weeks: [24, 36], everyWeeks: 1, hint: 'sideShoots' },
      { type: 'fertilize', weeks: [24, 34], everyWeeks: 2, hint: 'fertilize' },
      { type: 'water', weeks: [22, 38], hint: 'water' },
    ],
  },
  {
    id: 'lettuce', category: 'vegetable', family: 'asteraceae', placement: 'bed', lifecycle: 'annual', color: '#7BC47F',
    feeder: 'light', frostTender: false, water: 'medium', rotationGapYears: 2,
    spacing: { row: 0.3, plant: 0.3 }, growDays: 60, harvestDays: 21,
    windows: w([[9, 28]], [[13, 32]], [[14, 34]], [[20, 42]]),
    care: [{ type: 'water', weeks: [18, 34], hint: 'water' }],
  },
  {
    id: 'radish', category: 'vegetable', family: 'brassicaceae', placement: 'bed', lifecycle: 'annual', color: '#E0457B',
    feeder: 'light', frostTender: false, water: 'medium', rotationGapYears: 3,
    spacing: { row: 0.15, plant: 0.03 }, growDays: 30, harvestDays: 10,
    windows: w(none, [[11, 22], [32, 38]], none, [[16, 26], [36, 43]]),
    care: [{ type: 'water', weeks: [14, 24], hint: 'water' }],
  },
  {
    id: 'bushBean', category: 'vegetable', family: 'fabaceae', placement: 'bed', lifecycle: 'annual', color: '#8DB33A',
    feeder: 'fixer', frostTender: true, water: 'medium', rotationGapYears: 3,
    spacing: { row: 0.4, plant: 0.1 }, growDays: 90, harvestDays: 30,
    windows: w(none, [[20, 27]], none, [[28, 38]]),
    care: [{ type: 'water', weeks: [26, 34], hint: 'water' }],
  },
  {
    id: 'runnerBean', category: 'vegetable', family: 'fabaceae', placement: 'bed', lifecycle: 'annual', color: '#5E8C31',
    feeder: 'fixer', frostTender: true, water: 'high', rotationGapYears: 3,
    spacing: { row: 0.8, plant: 0.4 }, growDays: 120, harvestDays: 60,
    windows: w([[17, 19]], [[20, 24]], [[21, 24]], [[30, 40]]),
    care: [
      { type: 'care', weeks: [22, 25], hint: 'poles' },
      { type: 'water', weeks: [27, 36], hint: 'water' },
    ],
  },
  {
    id: 'pea', category: 'vegetable', family: 'fabaceae', placement: 'bed', lifecycle: 'annual', color: '#A4C639',
    feeder: 'fixer', frostTender: false, water: 'medium', rotationGapYears: 4,
    spacing: { row: 0.4, plant: 0.05 }, growDays: 90, harvestDays: 21,
    windows: w(none, [[11, 18]], none, [[24, 30]]),
    care: [{ type: 'care', weeks: [16, 20], hint: 'support' }],
  },
  {
    id: 'potato', category: 'vegetable', family: 'solanaceae', placement: 'bed', lifecycle: 'annual', color: '#C9A15B',
    feeder: 'heavy', frostTender: true, water: 'medium', rotationGapYears: 4,
    spacing: { row: 0.7, plant: 0.35 }, growDays: 120, harvestDays: 30,
    windows: w(none, none, [[15, 19]], [[26, 40]]),
    care: [{ type: 'care', weeks: [19, 24], hint: 'earthUp' }],
  },
  {
    id: 'zucchini', category: 'vegetable', family: 'cucurbitaceae', placement: 'bed', lifecycle: 'annual', color: '#4E9A4A',
    feeder: 'heavy', frostTender: true, water: 'high', rotationGapYears: 3,
    spacing: { row: 1, plant: 1 }, growDays: 120, harvestDays: 70,
    windows: w([[15, 18]], [[20, 23]], [[20, 23]], [[27, 40]]),
    care: [
      { type: 'fertilize', weeks: [24, 32], everyWeeks: 3, hint: 'fertilize' },
      { type: 'water', weeks: [22, 36], hint: 'water' },
    ],
  },
  {
    id: 'cucumber', category: 'vegetable', family: 'cucurbitaceae', placement: 'bed', lifecycle: 'annual', color: '#2E7D32',
    feeder: 'heavy', frostTender: true, water: 'high', rotationGapYears: 3,
    spacing: { row: 1, plant: 0.5 }, growDays: 110, harvestDays: 60,
    windows: w([[16, 18]], [[20, 22]], [[20, 23]], [[28, 38]]),
    care: [
      { type: 'water', weeks: [23, 36], hint: 'water' },
      { type: 'fertilize', weeks: [25, 33], everyWeeks: 2, hint: 'fertilize' },
    ],
  },
  {
    id: 'pumpkin', category: 'vegetable', family: 'cucurbitaceae', placement: 'bed', lifecycle: 'annual', color: '#E67E22',
    feeder: 'heavy', frostTender: true, water: 'high', rotationGapYears: 3,
    spacing: { row: 1.5, plant: 1.2 }, growDays: 150, harvestDays: 30,
    windows: w([[15, 18]], none, [[20, 23]], [[36, 42]]),
    care: [
      { type: 'fertilize', weeks: [25, 32], everyWeeks: 3, hint: 'fertilize' },
      { type: 'care', weeks: [30, 34], hint: 'raiseFruit' },
    ],
  },
  {
    id: 'onion', category: 'vegetable', family: 'amaryllidaceae', placement: 'bed', lifecycle: 'annual', color: '#9B59B6',
    feeder: 'light', frostTender: false, water: 'low', rotationGapYears: 4,
    spacing: { row: 0.25, plant: 0.1 }, growDays: 140, harvestDays: 21,
    windows: w(none, [[11, 15]], [[12, 16]], [[30, 36]]),
    care: [{ type: 'water', weeks: [28, 31], hint: 'stopWatering' }],
  },
  {
    id: 'garlic', category: 'vegetable', family: 'amaryllidaceae', placement: 'bed', lifecycle: 'annual', color: '#B9A88E',
    feeder: 'light', frostTender: false, water: 'low', rotationGapYears: 4,
    spacing: { row: 0.25, plant: 0.12 }, growDays: 270, harvestDays: 21,
    windows: w(none, none, [[40, 45], [10, 13]], [[27, 31]]),
    care: [{ type: 'water', weeks: [24, 26], hint: 'stopWatering' }],
  },
  {
    id: 'leek', category: 'vegetable', family: 'amaryllidaceae', placement: 'bed', lifecycle: 'annual', color: '#6B8E23',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 4,
    spacing: { row: 0.3, plant: 0.15 }, growDays: 180, harvestDays: 90,
    windows: w([[9, 14]], none, [[20, 26]], [[36, 52]]),
    care: [{ type: 'care', weeks: [28, 34], hint: 'earthUp' }],
  },
  {
    id: 'springOnion', category: 'vegetable', family: 'amaryllidaceae', placement: 'bed', lifecycle: 'annual', color: '#8BC34A',
    feeder: 'light', frostTender: false, water: 'medium', rotationGapYears: 3,
    spacing: { row: 0.2, plant: 0.03 }, growDays: 90, harvestDays: 40,
    windows: w(none, [[11, 30]], none, [[22, 44]]),
    care: [],
  },
  {
    id: 'beetroot', category: 'vegetable', family: 'amaranthaceae', placement: 'bed', lifecycle: 'annual', color: '#8E1C4A',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 3,
    spacing: { row: 0.3, plant: 0.1 }, growDays: 100, harvestDays: 30,
    windows: w(none, [[15, 26]], none, [[26, 42]]),
    care: [{ type: 'care', weeks: [20, 28], hint: 'thin' }],
  },
  {
    id: 'spinach', category: 'vegetable', family: 'amaranthaceae', placement: 'bed', lifecycle: 'annual', color: '#2F6B3A',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 3,
    spacing: { row: 0.25, plant: 0.05 }, growDays: 60, harvestDays: 21,
    windows: w(none, [[10, 16], [33, 38]], none, [[16, 24], [38, 46]]),
    care: [{ type: 'water', weeks: [14, 22], hint: 'bolt' }],
  },
  {
    id: 'chard', category: 'vegetable', family: 'amaranthaceae', placement: 'bed', lifecycle: 'annual', color: '#D35400',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 3,
    spacing: { row: 0.4, plant: 0.3 }, growDays: 150, harvestDays: 100,
    windows: w(none, [[15, 24]], none, [[26, 46]]),
    care: [{ type: 'care', weeks: [26, 44], hint: 'outerLeaves' }],
  },
  {
    id: 'kale', category: 'vegetable', family: 'brassicaceae', placement: 'bed', lifecycle: 'annual', color: '#355E3B',
    feeder: 'heavy', frostTender: false, water: 'medium', rotationGapYears: 4,
    spacing: { row: 0.5, plant: 0.5 }, growDays: 180, harvestDays: 90,
    windows: w([[18, 22]], [[20, 24]], [[24, 28]], [[42, 52]]),
    care: [{ type: 'fertilize', weeks: [28, 34], hint: 'fertilize' }],
  },
  {
    id: 'cabbage', category: 'vegetable', family: 'brassicaceae', placement: 'bed', lifecycle: 'annual', color: '#9CC5A1',
    feeder: 'heavy', frostTender: false, water: 'high', rotationGapYears: 4,
    spacing: { row: 0.6, plant: 0.5 }, growDays: 150, harvestDays: 30,
    windows: w([[10, 14]], none, [[17, 22]], [[34, 44]]),
    care: [
      { type: 'care', weeks: [20, 30], hint: 'nets' },
      { type: 'fertilize', weeks: [22, 30], everyWeeks: 3, hint: 'fertilize' },
    ],
  },
  {
    id: 'cauliflower', category: 'vegetable', family: 'brassicaceae', placement: 'bed', lifecycle: 'annual', color: '#CDBF91',
    feeder: 'heavy', frostTender: false, water: 'high', rotationGapYears: 4,
    spacing: { row: 0.6, plant: 0.5 }, growDays: 120, harvestDays: 21,
    windows: w([[10, 15]], none, [[17, 22]], [[28, 40]]),
    care: [{ type: 'care', weeks: [26, 36], hint: 'coverHead' }],
  },
  {
    id: 'broccoli', category: 'vegetable', family: 'brassicaceae', placement: 'bed', lifecycle: 'annual', color: '#3D7A4B',
    feeder: 'heavy', frostTender: false, water: 'high', rotationGapYears: 4,
    spacing: { row: 0.5, plant: 0.4 }, growDays: 100, harvestDays: 30,
    windows: w([[11, 16]], none, [[17, 24]], [[26, 40]]),
    care: [{ type: 'care', weeks: [28, 40], hint: 'sideShoots' }],
  },
  {
    id: 'kohlrabi', category: 'vegetable', family: 'brassicaceae', placement: 'bed', lifecycle: 'annual', color: '#A1D490',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 4,
    spacing: { row: 0.3, plant: 0.25 }, growDays: 70, harvestDays: 21,
    windows: w([[9, 14]], none, [[14, 30]], [[20, 40]]),
    care: [{ type: 'water', weeks: [18, 34], hint: 'water' }],
  },
  {
    id: 'brusselsSprouts', category: 'vegetable', family: 'brassicaceae', placement: 'bed', lifecycle: 'annual', color: '#4F7942',
    feeder: 'heavy', frostTender: false, water: 'medium', rotationGapYears: 4,
    spacing: { row: 0.6, plant: 0.6 }, growDays: 210, harvestDays: 90,
    windows: w([[14, 17]], none, [[20, 24]], [[42, 52]]),
    care: [{ type: 'care', weeks: [36, 40], hint: 'topping' }],
  },
  {
    id: 'rocket', category: 'vegetable', family: 'brassicaceae', placement: 'bed', lifecycle: 'annual', color: '#7DAA48',
    feeder: 'light', frostTender: false, water: 'medium', rotationGapYears: 3,
    spacing: { row: 0.2, plant: 0.05 }, growDays: 45, harvestDays: 21,
    windows: w(none, [[12, 20], [32, 36]], none, [[17, 26], [36, 42]]),
    care: [{ type: 'water', weeks: [16, 26], hint: 'water' }],
  },
  {
    id: 'bellPepper', category: 'vegetable', family: 'solanaceae', placement: 'bed', lifecycle: 'annual', color: '#F1C40F',
    feeder: 'heavy', frostTender: true, water: 'medium', rotationGapYears: 3,
    spacing: { row: 0.5, plant: 0.4 }, growDays: 140, harvestDays: 60,
    windows: w([[6, 10]], none, [[21, 23]], [[31, 41]]),
    care: [{ type: 'fertilize', weeks: [25, 34], everyWeeks: 2, hint: 'fertilize' }],
  },
  {
    id: 'chili', category: 'vegetable', family: 'solanaceae', placement: 'bed', lifecycle: 'annual', color: '#B03A2E',
    feeder: 'medium', frostTender: true, water: 'medium', rotationGapYears: 3,
    spacing: { row: 0.5, plant: 0.4 }, growDays: 150, harvestDays: 70,
    windows: w([[4, 9]], none, [[21, 23]], [[31, 42]]),
    care: [{ type: 'care', weeks: [21, 23], hint: 'warm' }],
  },
  {
    id: 'eggplant', category: 'vegetable', family: 'solanaceae', placement: 'bed', lifecycle: 'annual', color: '#5B2C6F',
    feeder: 'heavy', frostTender: true, water: 'high', rotationGapYears: 3,
    spacing: { row: 0.6, plant: 0.5 }, growDays: 140, harvestDays: 50,
    windows: w([[6, 10]], none, [[21, 24]], [[32, 40]]),
    care: [{ type: 'fertilize', weeks: [26, 34], everyWeeks: 2, hint: 'fertilize' }],
  },
  {
    id: 'sweetCorn', category: 'vegetable', family: 'poaceae', placement: 'bed', lifecycle: 'annual', color: '#F4D03F',
    feeder: 'heavy', frostTender: true, water: 'medium', rotationGapYears: 2,
    spacing: { row: 0.7, plant: 0.3 }, growDays: 120, harvestDays: 21,
    windows: w([[16, 18]], [[19, 22]], [[20, 23]], [[33, 38]]),
    care: [{ type: 'care', weeks: [19, 23], hint: 'block' }],
  },
  {
    id: 'celeriac', category: 'vegetable', family: 'apiaceae', placement: 'bed', lifecycle: 'annual', color: '#C8B88A',
    feeder: 'heavy', frostTender: false, water: 'high', rotationGapYears: 4,
    spacing: { row: 0.5, plant: 0.4 }, growDays: 180, harvestDays: 30,
    windows: w([[8, 12]], none, [[20, 23]], [[40, 45]]),
    care: [{ type: 'care', weeks: [30, 34], hint: 'removeLeaves' }],
  },
  {
    id: 'fennel', category: 'vegetable', family: 'apiaceae', placement: 'bed', lifecycle: 'annual', color: '#B5D99C',
    feeder: 'medium', frostTender: false, water: 'high', rotationGapYears: 4,
    spacing: { row: 0.4, plant: 0.3 }, growDays: 90, harvestDays: 21,
    windows: w([[14, 18]], [[24, 29]], [[19, 23]], [[34, 42]]),
    care: [{ type: 'care', weeks: [30, 34], hint: 'earthUp' }],
  },
  {
    id: 'parsnip', category: 'vegetable', family: 'apiaceae', placement: 'bed', lifecycle: 'annual', color: '#CFB87C',
    feeder: 'light', frostTender: false, water: 'medium', rotationGapYears: 4,
    spacing: { row: 0.35, plant: 0.1 }, growDays: 200, harvestDays: 90,
    windows: w(none, [[11, 18]], none, [[40, 52]]),
    care: [{ type: 'care', weeks: [20, 24], hint: 'thin' }],
  },
  {
    id: 'lambsLettuce', category: 'vegetable', family: 'caprifoliaceae', placement: 'bed', lifecycle: 'annual', color: '#6FA65A',
    feeder: 'light', frostTender: false, water: 'medium', rotationGapYears: 2,
    spacing: { row: 0.1, plant: 0.05 }, growDays: 90, harvestDays: 60,
    windows: w(none, [[31, 38]], none, [[40, 52], [1, 12]]),
    care: [{ type: 'water', weeks: [31, 36], hint: 'germination' }],
  },
  {
    id: 'asparagus', category: 'vegetable', family: 'asparagaceae', placement: 'bed', lifecycle: 'perennial', color: '#7BA05B',
    feeder: 'heavy', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 1, plant: 0.4 }, growDays: null, harvestDays: 56,
    windows: w(none, none, [[15, 18]], [[16, 25]]),
    care: [
      { type: 'care', weeks: [25, 26], hint: 'stopHarvest' },
      { type: 'fertilize', weeks: [26, 28], hint: 'fertilize' },
    ],
  },
  {
    id: 'rhubarb', category: 'vegetable', family: 'polygonaceae', placement: 'bed', lifecycle: 'perennial', color: '#C2185B',
    feeder: 'heavy', frostTender: false, water: 'high', rotationGapYears: 0,
    spacing: { row: 1, plant: 1 }, growDays: null, harvestDays: 70,
    windows: w(none, none, [[11, 14], [40, 44]], [[16, 25]]),
    care: [
      { type: 'fertilize', weeks: [10, 12], hint: 'fertilize' },
      { type: 'care', weeks: [25, 26], hint: 'stopHarvest' },
    ],
  },

  // --- Herbs ----------------------------------------------------------------
  {
    id: 'basil', category: 'herb', family: 'lamiaceae', placement: 'bed', lifecycle: 'annual', color: '#3E8E41',
    feeder: 'medium', frostTender: true, water: 'medium', rotationGapYears: 2,
    spacing: { row: 0.25, plant: 0.25 }, growDays: 100, harvestDays: 70,
    windows: w([[13, 18]], none, [[20, 24]], [[25, 40]]),
    care: [{ type: 'prune', weeks: [24, 38], everyWeeks: 2, hint: 'pinch' }],
  },
  {
    id: 'parsley', category: 'herb', family: 'apiaceae', placement: 'bed', lifecycle: 'biennial', color: '#5BAE5B',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 4,
    spacing: { row: 0.25, plant: 0.15 }, growDays: 150, harvestDays: 100,
    windows: w(none, [[13, 30]], none, [[22, 44]]),
    care: [{ type: 'water', weeks: [16, 22], hint: 'germination' }],
  },
  {
    id: 'chives', category: 'herb', family: 'amaryllidaceae', placement: 'bed', lifecycle: 'perennial', color: '#8E6CB8',
    feeder: 'light', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 0.25, plant: 0.2 }, growDays: null, harvestDays: 150,
    windows: w([[9, 12]], [[14, 20]], [[15, 20]], [[13, 40]]),
    care: [{ type: 'prune', weeks: [24, 28], hint: 'cutFlowers' }],
  },
  {
    id: 'dill', category: 'herb', family: 'apiaceae', placement: 'bed', lifecycle: 'annual', color: '#9ACD32',
    feeder: 'light', frostTender: false, water: 'medium', rotationGapYears: 3,
    spacing: { row: 0.3, plant: 0.05 }, growDays: 70, harvestDays: 40,
    windows: w(none, [[14, 28]], none, [[22, 36]]),
    care: [{ type: 'care', weeks: [18, 28], hint: 'resow' }],
  },
  {
    id: 'thyme', category: 'herb', family: 'lamiaceae', placement: 'bed', lifecycle: 'perennial', color: '#8FA876',
    feeder: 'light', frostTender: false, water: 'low', rotationGapYears: 0,
    spacing: { row: 0.3, plant: 0.25 }, growDays: null, harvestDays: 150,
    windows: w([[10, 14]], none, [[18, 22]], [[18, 40]]),
    care: [{ type: 'prune', weeks: [14, 16], hint: 'cutBack' }],
  },
  {
    id: 'rosemary', category: 'herb', family: 'lamiaceae', placement: 'bed', lifecycle: 'perennial', color: '#5B7F6A',
    feeder: 'light', frostTender: true, water: 'low', rotationGapYears: 0,
    spacing: { row: 0.5, plant: 0.5 }, growDays: null, harvestDays: 200,
    windows: w(none, none, [[19, 22]], [[16, 42]]),
    care: [
      { type: 'prune', weeks: [16, 18], hint: 'cutBack' },
      { type: 'care', weeks: [44, 46], hint: 'winterProtection' },
    ],
  },
  {
    id: 'sage', category: 'herb', family: 'lamiaceae', placement: 'bed', lifecycle: 'perennial', color: '#8EA79B',
    feeder: 'light', frostTender: false, water: 'low', rotationGapYears: 0,
    spacing: { row: 0.4, plant: 0.4 }, growDays: null, harvestDays: 150,
    windows: w([[10, 14]], none, [[18, 22]], [[18, 40]]),
    care: [{ type: 'prune', weeks: [13, 15], hint: 'cutBack' }],
  },
  {
    id: 'mint', category: 'herb', family: 'lamiaceae', placement: 'bed', lifecycle: 'perennial', color: '#3EB489',
    feeder: 'medium', frostTender: false, water: 'high', rotationGapYears: 0,
    spacing: { row: 0.4, plant: 0.3 }, growDays: null, harvestDays: 150,
    windows: w(none, none, [[14, 20]], [[18, 40]]),
    care: [{ type: 'care', weeks: [14, 16], hint: 'rootBarrier' }],
  },
  {
    id: 'oregano', category: 'herb', family: 'lamiaceae', placement: 'bed', lifecycle: 'perennial', color: '#7A8B4F',
    feeder: 'light', frostTender: false, water: 'low', rotationGapYears: 0,
    spacing: { row: 0.3, plant: 0.3 }, growDays: null, harvestDays: 120,
    windows: w([[10, 14]], none, [[18, 22]], [[24, 38]]),
    care: [{ type: 'prune', weeks: [13, 15], hint: 'cutBack' }],
  },
  {
    id: 'coriander', category: 'herb', family: 'apiaceae', placement: 'bed', lifecycle: 'annual', color: '#76B947',
    feeder: 'light', frostTender: false, water: 'medium', rotationGapYears: 3,
    spacing: { row: 0.25, plant: 0.1 }, growDays: 60, harvestDays: 30,
    windows: w(none, [[15, 30]], none, [[20, 38]]),
    care: [{ type: 'care', weeks: [18, 30], hint: 'resow' }],
  },

  // --- Berries --------------------------------------------------------------
  {
    id: 'strawberry', category: 'berry', family: 'rosaceae', placement: 'bed', lifecycle: 'perennial', color: '#D7263D',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 4,
    spacing: { row: 0.6, plant: 0.3 }, growDays: null, harvestDays: 35,
    windows: w(none, none, [[30, 36]], [[23, 28]]),
    care: [
      { type: 'care', weeks: [18, 20], hint: 'mulch' },
      { type: 'prune', weeks: [29, 32], hint: 'runners' },
      { type: 'fertilize', weeks: [30, 32], hint: 'fertilize' },
    ],
  },
  {
    id: 'raspberry', category: 'berry', family: 'rosaceae', placement: 'shrub', lifecycle: 'perennial', color: '#B0306A',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 1.5, plant: 0.5 }, growDays: null, harvestDays: 40,
    windows: w(none, none, [[42, 47]], [[26, 32]]),
    care: [
      { type: 'care', weeks: [12, 16], hint: 'mulch' },
      { type: 'prune', weeks: [32, 36], hint: 'cutCanes' },
    ],
  },
  {
    id: 'blackberry', category: 'berry', family: 'rosaceae', placement: 'shrub', lifecycle: 'perennial', color: '#4A235A',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 2.5, plant: 2 }, growDays: null, harvestDays: 50,
    windows: w(none, none, [[42, 47]], [[31, 38]]),
    care: [
      { type: 'care', weeks: [16, 24], hint: 'tieCanes' },
      { type: 'prune', weeks: [38, 42], hint: 'cutCanes' },
    ],
  },
  {
    id: 'redcurrant', category: 'berry', family: 'grossulariaceae', placement: 'shrub', lifecycle: 'perennial', color: '#C62F3B',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 1.5, plant: 1.2 }, growDays: null, harvestDays: 30,
    windows: w(none, none, [[42, 47]], [[26, 30]]),
    care: [
      { type: 'prune', weeks: [6, 10], hint: 'pruning' },
      { type: 'fertilize', weeks: [12, 15], hint: 'fertilize' },
    ],
  },
  {
    id: 'blackcurrant', category: 'berry', family: 'grossulariaceae', placement: 'shrub', lifecycle: 'perennial', color: '#3E2A5C',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 1.5, plant: 1.5 }, growDays: null, harvestDays: 30,
    windows: w(none, none, [[42, 47]], [[27, 31]]),
    care: [
      { type: 'prune', weeks: [6, 10], hint: 'pruning' },
      { type: 'fertilize', weeks: [12, 15], hint: 'fertilize' },
    ],
  },
  {
    id: 'gooseberry', category: 'berry', family: 'grossulariaceae', placement: 'shrub', lifecycle: 'perennial', color: '#9DC183',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 1.5, plant: 1.2 }, growDays: null, harvestDays: 30,
    windows: w(none, none, [[42, 47]], [[25, 30]]),
    care: [
      { type: 'prune', weeks: [6, 10], hint: 'pruning' },
      { type: 'care', weeks: [22, 26], hint: 'mildew' },
    ],
  },
  {
    id: 'blueberry', category: 'berry', family: 'ericaceae', placement: 'shrub', lifecycle: 'perennial', color: '#4F6DAF',
    feeder: 'light', frostTender: false, water: 'high', rotationGapYears: 0,
    spacing: { row: 1.5, plant: 1.2 }, growDays: null, harvestDays: 45,
    windows: w(none, none, [[12, 16], [42, 47]], [[28, 35]]),
    care: [
      { type: 'prune', weeks: [8, 11], hint: 'pruning' },
      { type: 'fertilize', weeks: [14, 18], hint: 'acidSoil' },
    ],
  },

  // --- Fruit trees ----------------------------------------------------------
  {
    id: 'apple', category: 'fruitTree', family: 'rosaceae', placement: 'tree', lifecycle: 'perennial', color: '#8BBF3F',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 4, plant: 4 }, growDays: null, harvestDays: 60,
    windows: w(none, none, [[43, 48]], [[33, 42]]),
    care: [
      { type: 'prune', weeks: [6, 10], hint: 'winterPruning' },
      { type: 'fertilize', weeks: [12, 15], hint: 'fertilize' },
      { type: 'care', weeks: [25, 28], hint: 'thinFruit' },
    ],
  },
  {
    id: 'pear', category: 'fruitTree', family: 'rosaceae', placement: 'tree', lifecycle: 'perennial', color: '#C5B358',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 4, plant: 4 }, growDays: null, harvestDays: 45,
    windows: w(none, none, [[43, 48]], [[34, 42]]),
    care: [
      { type: 'prune', weeks: [6, 10], hint: 'winterPruning' },
      { type: 'fertilize', weeks: [12, 15], hint: 'fertilize' },
    ],
  },
  {
    id: 'cherry', category: 'fruitTree', family: 'rosaceae', placement: 'tree', lifecycle: 'perennial', color: '#A31F48',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 5, plant: 5 }, growDays: null, harvestDays: 30,
    windows: w(none, none, [[43, 48]], [[25, 30]]),
    care: [
      { type: 'fertilize', weeks: [12, 15], hint: 'fertilize' },
      { type: 'prune', weeks: [30, 34], hint: 'summerPruning' },
    ],
  },
  {
    id: 'sourCherry', category: 'fruitTree', family: 'rosaceae', placement: 'tree', lifecycle: 'perennial', color: '#9B1B30',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 4, plant: 4 }, growDays: null, harvestDays: 21,
    windows: w(none, none, [[43, 48]], [[27, 31]]),
    care: [
      { type: 'fertilize', weeks: [12, 15], hint: 'fertilize' },
      { type: 'prune', weeks: [30, 34], hint: 'summerPruning' },
    ],
  },
  {
    id: 'plum', category: 'fruitTree', family: 'rosaceae', placement: 'tree', lifecycle: 'perennial', color: '#5D3A6B',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 4, plant: 4 }, growDays: null, harvestDays: 40,
    windows: w(none, none, [[43, 48]], [[32, 39]]),
    care: [
      { type: 'fertilize', weeks: [12, 15], hint: 'fertilize' },
      { type: 'prune', weeks: [30, 34], hint: 'summerPruning' },
    ],
  },
  {
    id: 'peach', category: 'fruitTree', family: 'rosaceae', placement: 'tree', lifecycle: 'perennial', color: '#F5A07A',
    feeder: 'medium', frostTender: true, water: 'medium', rotationGapYears: 0,
    spacing: { row: 4, plant: 4 }, growDays: null, harvestDays: 30,
    windows: w(none, none, [[12, 16]], [[31, 36]]),
    care: [
      { type: 'care', weeks: [5, 8], hint: 'leafCurl' },
      { type: 'prune', weeks: [13, 16], hint: 'springPruning' },
    ],
  },

  // --- Shrubs -------------------------------------------------------------
  {
    id: 'lavender', category: 'shrub', family: 'lamiaceae', placement: 'shrub', lifecycle: 'perennial', color: '#9B7EDE',
    feeder: 'light', frostTender: false, water: 'low', rotationGapYears: 0,
    spacing: { row: 0.5, plant: 0.4 }, growDays: null, harvestDays: 30,
    windows: w(none, none, [[17, 22]], [[26, 30]]),
    care: [
      { type: 'prune', weeks: [14, 16], hint: 'springCut' },
      { type: 'prune', weeks: [31, 34], hint: 'cutAfterFlowering' },
    ],
  },
  {
    id: 'rose', category: 'shrub', family: 'rosaceae', placement: 'shrub', lifecycle: 'perennial', color: '#E91E63',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 1, plant: 0.8 }, growDays: null, harvestDays: 30,
    windows: w(none, none, [[42, 47]], none),
    care: [
      { type: 'prune', weeks: [13, 15], hint: 'springPruning' },
      { type: 'fertilize', weeks: [14, 16], hint: 'fertilize' },
      { type: 'prune', weeks: [24, 36], everyWeeks: 2, hint: 'deadhead' },
      { type: 'fertilize', weeks: [25, 27], hint: 'summerFertilize' },
    ],
  },
  {
    id: 'hydrangea', category: 'shrub', family: 'hydrangeaceae', placement: 'shrub', lifecycle: 'perennial', color: '#7FA7D9',
    feeder: 'medium', frostTender: false, water: 'high', rotationGapYears: 0,
    spacing: { row: 1.2, plant: 1 }, growDays: null, harvestDays: 30,
    windows: w(none, none, [[15, 20], [38, 42]], none),
    care: [
      { type: 'prune', weeks: [12, 14], hint: 'springPruning' },
      { type: 'water', weeks: [24, 34], hint: 'water' },
    ],
  },
  {
    id: 'elder', category: 'shrub', family: 'adoxaceae', placement: 'shrub', lifecycle: 'perennial', color: '#4B4453',
    feeder: 'medium', frostTender: false, water: 'medium', rotationGapYears: 0,
    spacing: { row: 3, plant: 3 }, growDays: null, harvestDays: 30,
    windows: w(none, none, [[42, 47]], [[22, 25], [34, 38]]),
    care: [{ type: 'prune', weeks: [6, 10], hint: 'pruning' }],
  },
];

/** Good and bad neighbours (common companion-planting advice), one pair per line. */
const GOOD_NEIGHBOURS = [
  ['carrot', 'onion'], ['carrot', 'radish'], ['carrot', 'lettuce'], ['carrot', 'tomato'], ['carrot', 'leek'],
  ['carrot', 'pea'], ['carrot', 'chives'], ['carrot', 'dill'], ['carrot', 'garlic'], ['carrot', 'springOnion'],
  ['tomato', 'basil'], ['tomato', 'parsley'], ['tomato', 'lettuce'], ['tomato', 'onion'], ['tomato', 'radish'],
  ['tomato', 'garlic'], ['tomato', 'chives'], ['tomato', 'leek'],
  ['lettuce', 'radish'], ['lettuce', 'onion'], ['lettuce', 'strawberry'], ['lettuce', 'bushBean'], ['lettuce', 'kohlrabi'],
  ['lettuce', 'beetroot'], ['lettuce', 'cucumber'], ['lettuce', 'pea'], ['lettuce', 'rocket'], ['lettuce', 'springOnion'],
  ['radish', 'bushBean'], ['radish', 'spinach'], ['radish', 'chard'], ['radish', 'pea'],
  ['bushBean', 'potato'], ['bushBean', 'strawberry'], ['bushBean', 'zucchini'], ['bushBean', 'cabbage'], ['bushBean', 'beetroot'],
  ['bushBean', 'cucumber'], ['bushBean', 'eggplant'],
  ['runnerBean', 'sweetCorn'], ['runnerBean', 'pumpkin'],
  ['pumpkin', 'sweetCorn'], ['cucumber', 'sweetCorn'], ['cucumber', 'dill'], ['cucumber', 'pea'],
  ['zucchini', 'onion'], ['onion', 'strawberry'], ['onion', 'beetroot'], ['onion', 'parsnip'],
  ['garlic', 'strawberry'], ['chives', 'strawberry'], ['leek', 'celeriac'], ['leek', 'strawberry'],
  ['cabbage', 'celeriac'], ['cabbage', 'dill'], ['kohlrabi', 'beetroot'],
  ['spinach', 'strawberry'], ['spinach', 'potato'],
  ['bellPepper', 'basil'], ['chili', 'basil'],
];

const BAD_NEIGHBOURS = [
  ['tomato', 'potato'], ['tomato', 'fennel'], ['tomato', 'cucumber'], ['tomato', 'pea'],
  ['bushBean', 'onion'], ['bushBean', 'garlic'], ['bushBean', 'leek'], ['bushBean', 'fennel'],
  ['runnerBean', 'onion'], ['runnerBean', 'garlic'], ['runnerBean', 'fennel'],
  ['pea', 'onion'], ['pea', 'garlic'], ['pea', 'leek'],
  ['potato', 'zucchini'], ['potato', 'pumpkin'], ['potato', 'cucumber'],
  ['cabbage', 'strawberry'], ['cabbage', 'onion'],
  ['beetroot', 'spinach'], ['spinach', 'chard'],
];

function companionsOf(id) {
  const partners = (pairs) => pairs.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
  return { good: partners(GOOD_NEIGHBOURS), bad: partners(BAD_NEIGHBOURS) };
}

export const PLANTS = RAW_PLANTS.map((plant) => Object.freeze({ ...plant, companions: companionsOf(plant.id) }));

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

/** For tests: the raw neighbour pairs. */
export const NEIGHBOUR_PAIRS = { good: GOOD_NEIGHBOURS, bad: BAD_NEIGHBOURS };
