import { describe, test, expect } from './harness.js';
import { detectLanguage } from '../js/i18n/languages.js';

describe('detectLanguage', () => {
  test('matches the primary subtag', () => {
    expect(detectLanguage(['de-AT', 'en'])).toBe('de');
    expect(detectLanguage(['pt-BR'])).toBe('pt');
    expect(detectLanguage(['ES'])).toBe('es');
  });
  test('takes the first supported language', () => {
    expect(detectLanguage(['nl-NL', 'fr-CA', 'en'])).toBe('fr');
  });
  test('falls back to English', () => {
    expect(detectLanguage(['nl', 'ja'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
    expect(detectLanguage([undefined])).toBe('en');
  });
});
