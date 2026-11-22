import { describe, test, expect } from './harness.js';
import {
  isoWeekMonday, isoWeekOf, shiftWeek, windowDates, windowInstances, shiftFromLastFrost, lastFrostForShift, presetOf,
} from '../js/logic/climate.js';

describe('ISO weeks', () => {
  test('Monday of a week', () => {
    expect(isoWeekMonday(2026, 1)).toBe('2025-12-29');
    expect(isoWeekMonday(2026, 20)).toBe('2026-05-11');
    expect(isoWeekMonday(2021, 1)).toBe('2021-01-04');
    expect(isoWeekMonday(2026, 54)).toBe('2027-01-04'); // continues into the next year
  });
  test('week of a date', () => {
    expect(isoWeekOf('2026-05-11')).toEqual({ year: 2026, week: 20 });
    expect(isoWeekOf('2027-01-01')).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf('2025-12-29')).toEqual({ year: 2026, week: 1 });
    expect(isoWeekOf('2024-12-31')).toEqual({ year: 2025, week: 1 });
  });
});

describe('climate shift', () => {
  test('spring later and autumn earlier in a cold climate', () => {
    expect(shiftWeek(20, { hemisphere: 'north', shiftWeeks: 2 })).toBe(22);
    expect(shiftWeek(40, { hemisphere: 'north', shiftWeeks: 2 })).toBe(38);
    expect(shiftWeek(20, { hemisphere: 'north', shiftWeeks: -2 })).toBe(18);
    expect(shiftWeek(40, { hemisphere: 'north', shiftWeeks: -2 })).toBe(42);
  });
  test('southern hemisphere is half a year later', () => {
    expect(shiftWeek(20, { hemisphere: 'south', shiftWeeks: 0 })).toBe(46);
  });
  test('window dates, also shrunk to nothing', () => {
    expect(windowDates([20, 23], 2026, { hemisphere: 'north', shiftWeeks: 0 })).toEqual({ start: '2026-05-11', end: '2026-06-07' });
    const squeezed = windowDates([25, 27], 2026, { hemisphere: 'north', shiftWeeks: 4 }); // 29 … 23
    expect(squeezed.start <= squeezed.end).toBeTruthy();
  });
  test('instances overlapping a range, across the year end in the south', () => {
    const south = { hemisphere: 'south', shiftWeeks: 0 };
    // Harvest weeks 29–41 become 55–67: the 2026 window falls in January to early April 2027
    // (2026 has 53 ISO weeks)
    const instances = windowInstances([29, 41], south, '2027-01-01', '2027-12-31');
    expect(instances.length).toBe(1);
    expect(instances[0].start).toBe('2027-01-11');
    expect(instances[0].end).toBe('2027-04-11');
  });
  test('last frost date and presets', () => {
    expect(shiftFromLastFrost('05-15')).toBe(0);
    expect(shiftFromLastFrost('05-29')).toBe(2);
    expect(shiftFromLastFrost('04-17')).toBe(-4);
    expect(shiftFromLastFrost('08-01')).toBe(8);
    expect(lastFrostForShift(2)).toBe('05-29');
    expect(presetOf(-2)).toBe('mild');
    expect(presetOf(3)).toBe('custom');
  });
});
