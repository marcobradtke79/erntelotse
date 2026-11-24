import { describe, test, expect } from './harness.js';
import { PROVIDER, PRIVACY_DATE } from '../js/data/provider.js';
import { isIsoDate } from '../js/logic/dates.js';

describe('provider details for the legal notice', () => {
  test('every field is filled in', () => {
    for (const field of ['name', 'street', 'postalCode', 'city', 'country', 'email', 'phone']) {
      expect(typeof PROVIDER[field] === 'string' && PROVIDER[field].trim().length > 1 ? field : `${field} is missing`).toBe(field);
    }
  });
  test('no placeholder text', () => {
    expect(Object.values(PROVIDER).filter((value) => /todo|xxx|example|muster|placeholder/i.test(value))).toEqual([]);
  });
  test('e-mail, phone, country and date are well-formed', () => {
    expect(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(PROVIDER.email)).toBeTruthy();
    expect(/^\+?[\d ()/-]{6,}$/.test(PROVIDER.phone)).toBeTruthy();
    expect(/^[A-Z]{2}$/.test(PROVIDER.country)).toBeTruthy();
    expect(isIsoDate(PRIVACY_DATE)).toBeTruthy();
  });
});
