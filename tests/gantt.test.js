import { describe, test, expect } from './harness.js';
import { ganttGroups, lanes, position, yearRange, monthRange, seasonRange, weekColumns, monthSpans } from '../js/logic/gantt.js';
import { hintsFor } from '../js/logic/hints.js';
import { buildCatalog } from '../js/logic/catalog.js';
import { createGarden } from '../js/logic/gardenModel.js';
import { createElementAt } from '../js/logic/elements.js';
import { createPlanting } from '../js/logic/plantings.js';
import { PLANTS } from '../js/data/plants.js';

const catalog = buildCatalog(PLANTS);
const point = { kind: 'point', at: [1, 1] };

function garden() {
  const g = createGarden({ name: 'G', id: 'g_gantt' });
  const bed = (id, name) => Object.assign(createElementAt('bed', [2, 0.6], { width: 4, depth: 1.2, name }), { id });
  const tree = Object.assign(createElementAt('tree', [8, 8], { diameter: 4 }), { id: 'e_tree', plantId: 'apple' });
  const bare = Object.assign(createElementAt('tree', [12, 8], { diameter: 4 }), { id: 'e_bare' });
  g.elements.push(bed('e_b', 'Bed 2'), bed('e_a', 'Bed 1'), bed('e_c', 'Bed 3'), tree, bare);
  g.plantings = [
    createPlanting({ bedId: 'e_a', plantId: 'tomato', shape: point, start: '2026-05-18', end: '2026-10-04', preStart: '2026-03-09' }),
    createPlanting({ bedId: 'e_a', plantId: 'lettuce', shape: point, start: '2026-03-02', end: '2026-05-10' }),
    createPlanting({ bedId: 'e_b', plantId: 'carrot', shape: point, start: '2025-09-01', end: '2026-02-10' }),
    createPlanting({ bedId: 'e_b', plantId: 'garlic', shape: point, start: '2027-01-10', end: '2027-07-01', preStart: '2026-12-01' }),
    createPlanting({ bedId: 'e_b', plantId: 'radish', shape: point, start: '2024-04-01', end: '2024-05-01' }),
  ];
  return g;
}

const buildRange = (range) => {
  const g = garden();
  return ganttGroups(g, catalog, hintsFor(g, catalog, range), range);
};
const build = (year = 2026) => buildRange(yearRange(year));

describe('gantt chart of a year', () => {
  test('groups by bed in name order, trees and shrubs last, empty beds left out', () => {
    const groups = build();
    expect(groups.map((group) => group.id)).toEqual(['e_a', 'e_b', 'trees']);
    expect(groups[0].rows.map((row) => row.plantId)).toEqual(['lettuce', 'tomato']);
    expect(groups[2].rows.map((row) => row.id)).toEqual(['e_tree']);
  });
  test('phases: pre-cultivation, time in the bed and harvest', () => {
    const tomato = build()[0].rows[1];
    expect(tomato.phases.map((phase) => phase.kind)).toEqual(['pre', 'grow', 'harvest']);
    expect(tomato.phases[0]).toEqual({ kind: 'pre', start: '2026-03-09', end: '2026-05-17' });
    expect(tomato.phases[1]).toEqual({ kind: 'grow', start: '2026-05-18', end: '2026-10-04' });
    expect(tomato.phases[2].end).toBe('2026-10-04');
  });
  test('periods are clipped to the year; other years are left out', () => {
    const rows = build()[1].rows;
    expect(rows.map((row) => row.plantId)).toEqual(['carrot', 'garlic']);
    expect(rows[0].phases.find((phase) => phase.kind === 'grow')).toEqual({ kind: 'grow', start: '2026-01-01', end: '2026-02-10' });
    // only the pre-cultivation of next year's garlic lies in this year
    expect(rows[1].phases).toEqual([{ kind: 'pre', start: '2026-12-01', end: '2026-12-31' }]);
  });
  test('every row carries its activities; lanes group them by type', () => {
    const tomato = build()[0].rows[1];
    expect(tomato.activities.every((hint) => hint.sourceId === tomato.id)).toBeTruthy();
    expect(lanes(tomato).map((lane) => lane.type)).toEqual(['sow', 'plant', 'fertilize', 'prune', 'water', 'harvest']);
    expect(lanes(tomato, ['water', 'sow']).map((lane) => lane.type)).toEqual(['sow', 'water']);
    expect(lanes(tomato, [])).toEqual([]);
    const tree = build()[2].rows[0];
    expect(tree.phases.every((phase) => phase.kind === 'harvest')).toBeTruthy();
    expect(lanes(tree).length > 0).toBeTruthy();
  });
  test('one bed only: its plantings, no trees; empty when nothing lies in the range', () => {
    const g = garden();
    const range = yearRange(2026);
    const hints = hintsFor(g, catalog, range);
    const only = ganttGroups(g, catalog, hints, range, { bedId: 'e_b' });
    expect(only.map((group) => group.id)).toEqual(['e_b']);
    expect(only[0].rows.map((row) => row.plantId)).toEqual(['carrot', 'garlic']);
    expect(ganttGroups(g, catalog, hints, range, { bedId: 'e_c' })).toEqual([]);
  });
  test('position within the year and within a zoomed range', () => {
    const year = yearRange(2026);
    expect(position('2026-01-01', '2026-12-31', year)).toEqual({ left: 0, width: 100, cutStart: false, cutEnd: false });
    expect(position('2025-06-01', '2025-07-01', year)).toBe(null);
    const zoom = monthRange(2026, 5);
    expect(zoom).toEqual({ from: '2026-04-01', to: '2026-06-30' });
    expect(monthRange(2026, 1).from).toBe('2026-01-01');
    expect(monthRange(2026, 12)).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    const bar = position('2026-03-09', '2026-04-10', zoom);
    expect(bar.left).toBe(0);
    expect(bar.cutStart).toBe(true);
    expect(Math.round((bar.width / 100) * 91)).toBe(10);
    expect(position('2026-07-01', '2026-07-05', zoom)).toBe(null);
  });
});

describe('gantt chart of a season', () => {
  test('a season is 13 whole weeks from the Monday of the given week', () => {
    expect(seasonRange('2026-11-25')).toEqual({ from: '2026-11-23', to: '2027-02-21' });
    expect(seasonRange('2026-11-23', 1)).toEqual({ from: '2026-11-23', to: '2026-11-29' });
  });
  test('week columns run across the turn of the year', () => {
    const columns = weekColumns(seasonRange('2026-12-21', 4));
    expect(columns.map((column) => [column.year, column.week])).toEqual([[2026, 52], [2026, 53], [2027, 1], [2027, 2]]);
    expect(columns[1].monday).toBe('2026-12-28');
    expect(weekColumns(seasonRange('2026-11-23'))).toHaveLength(13);
  });
  test('months of a range are clipped to it', () => {
    expect(monthSpans(seasonRange('2026-12-21', 4))).toEqual([
      { year: 2026, month: 12, from: '2026-12-21', to: '2026-12-31' },
      { year: 2027, month: 1, from: '2027-01-01', to: '2027-01-17' },
    ]);
    expect(monthSpans(yearRange(2026))).toHaveLength(12);
  });
  test('a season over two years shows what lies in it, clipped at both ends', () => {
    const range = seasonRange('2026-11-23'); // 23 Nov 2026 – 21 Feb 2027
    const groups = buildRange(range);
    // bed 1 (lettuce, tomatoes) is over by then; bed 2 has next year's garlic
    expect(groups.map((group) => group.id)).toEqual(['e_b', 'trees']);
    const garlic = groups[0].rows[0];
    expect(garlic.plantId).toBe('garlic');
    expect(garlic.phases.filter((phase) => phase.kind !== 'harvest')).toEqual([
      { kind: 'pre', start: '2026-12-01', end: '2027-01-09' },
      { kind: 'grow', start: '2027-01-10', end: '2027-02-21' },
    ]);
    expect(garlic.activities.every((hint) => hint.end >= range.from && hint.start <= range.to)).toBeTruthy();
    const spring = buildRange(seasonRange('2026-03-02'));
    expect(spring[0].rows.map((row) => row.plantId)).toEqual(['lettuce', 'tomato']);
    expect(spring[0].rows[1].phases.map((phase) => phase.kind)).toEqual(['pre', 'grow']);
  });
});
