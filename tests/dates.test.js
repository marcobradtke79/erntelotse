import { describe, test, expect } from './harness.js';
import {
  isIsoDate, toIsoDate, todayIso, yearOf, addDays, daysBetween, addYears, withYear, daysInYear, dayOfYear, fromDayOfYear,
} from '../js/logic/dates.js';

describe('dates', () => {
  test('isIsoDate', () => {
    expect(isIsoDate('2026-02-28')).toBeTruthy();
    expect(isIsoDate('2024-02-29')).toBeTruthy();
    expect(isIsoDate('2026-02-29')).toBeFalsy();
    expect(isIsoDate('2026-13-01')).toBeFalsy();
    expect(isIsoDate('26-01-01')).toBeFalsy();
    expect(isIsoDate(null)).toBeFalsy();
  });
  test('today in local time', () => {
    expect(todayIso(new Date(2026, 10, 22, 23, 59))).toBe('2026-11-22');
    expect(toIsoDate(2026, 1, 5)).toBe('2026-01-05');
  });
  test('adding days across month, year and leap day', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364);
  });
  test('adding years keeps the day, 29 February becomes 28', () => {
    expect(addYears('2026-05-20', 1)).toBe('2027-05-20');
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
    expect(withYear('2026-11-22', 2024)).toBe('2024-11-22');
    expect(yearOf('2027-01-01')).toBe(2027);
  });
  test('day of year', () => {
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2026)).toBe(365);
    expect(dayOfYear('2026-01-01')).toBe(1);
    expect(dayOfYear('2026-12-31')).toBe(365);
    expect(fromDayOfYear(2024, 60)).toBe('2024-02-29');
  });
});
