import { describe, test, expect } from './harness.js';
import {
  formatLength, formatArea, formatWeight, formatTemperature, formatPrecipitation, formatBytes,
  parseNumber, toInputLength, fromInputLength, celsiusToFahrenheit, fahrenheitToCelsius,
  toInputWeight, fromInputWeight,
} from '../js/logic/units.js';

describe('formatLength', () => {
  test('metric below one metre in centimetres', () => {
    expect(formatLength(0.45, 'metric', 'en')).toBe('45 cm');
    expect(formatLength(0.004, 'metric', 'en')).toBe('0 cm');
  });
  test('metric from one metre in metres with up to two decimals', () => {
    expect(formatLength(4.8, 'metric', 'en')).toBe('4.8 m');
    expect(formatLength(1.234, 'metric', 'en')).toBe('1.23 m');
    expect(formatLength(1.5, 'metric', 'de')).toBe('1,5 m');
  });
  test('imperial in feet and inches, rounded to half inches', () => {
    expect(formatLength(1.4, 'imperial', 'en')).toBe('4 ft 7 in');
    expect(formatLength(0.19, 'imperial', 'en')).toBe('7½ in');
    expect(formatLength(0.3048, 'imperial', 'en')).toBe('1 ft');
    expect(formatLength(0.006, 'imperial', 'en')).toBe('0 in');
    expect(formatLength(0.01, 'imperial', 'en')).toBe('½ in');
  });
});

describe('formatArea', () => {
  test('metric', () => {
    expect(formatArea(4.8, 'metric', 'en')).toBe('4.8 m²');
    expect(formatArea(123.456, 'metric', 'en')).toBe('123.5 m²');
  });
  test('imperial', () => {
    expect(formatArea(4.8, 'imperial', 'en')).toBe('51.7 sq ft');
  });
});

describe('formatWeight', () => {
  test('metric', () => {
    expect(formatWeight(0.25, 'metric', 'en')).toBe('250 g');
    expect(formatWeight(4.5, 'metric', 'en')).toBe('4.5 kg');
    expect(formatWeight(4.5, 'metric', 'fr')).toBe('4,5 kg');
  });
  test('imperial in pounds and ounces', () => {
    expect(formatWeight(4.5, 'imperial', 'en')).toBe('9 lb 15 oz');
    expect(formatWeight(0.1, 'imperial', 'en')).toBe('4 oz');
    expect(formatWeight(0.45359237, 'imperial', 'en')).toBe('1 lb');
  });
});

describe('temperature and precipitation', () => {
  test('conversion both ways', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
    expect(fahrenheitToCelsius(212)).toBeCloseTo(100);
  });
  test('formatting', () => {
    expect(formatTemperature(3.4, 'metric', 'en')).toBe('3 °C');
    expect(formatTemperature(-0.2, 'metric', 'en')).toBe('0 °C');
    expect(formatTemperature(3.4, 'imperial', 'en')).toBe('38 °F');
    expect(formatPrecipitation(4.2, 'metric', 'en')).toBe('4.2 mm');
    expect(formatPrecipitation(25.4, 'imperial', 'en')).toBe('1 in');
  });
});

describe('formatBytes', () => {
  test('ranges', () => {
    expect(formatBytes(500, 'en')).toBe('500 B');
    expect(formatBytes(1500, 'en')).toBe('1.5 kB');
    expect(formatBytes(5000000, 'en')).toBe('5 MB');
  });
});

describe('parseNumber', () => {
  test('dot and comma decimals', () => {
    expect(parseNumber('1.5')).toBe(1.5);
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber(' 2 ')).toBe(2);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('-3,25')).toBe(-3.25);
  });
  test('grouping separators', () => {
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('1 234,5')).toBe(1234.5);
  });
  test('invalid input', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('1,2,3')).toBeNull();
    expect(parseNumber('1.2.3')).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber(NaN)).toBeNull();
  });
});

describe('input conversion', () => {
  test('length round trip', () => {
    expect(toInputLength(0.3048, 'imperial')).toBeCloseTo(1);
    expect(fromInputLength(toInputLength(2.5, 'imperial'), 'imperial')).toBeCloseTo(2.5);
    expect(toInputLength(2.5, 'metric')).toBe(2.5);
  });
  test('weight round trip', () => {
    expect(fromInputWeight(toInputWeight(4.5, 'imperial'), 'imperial')).toBeCloseTo(4.5);
  });
});
