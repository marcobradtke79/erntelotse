import { describe, test, expect } from './harness.js';
import { LANGUAGE_CODES } from '../js/i18n/languages.js';
import en from '../js/i18n/en.js';
import de from '../js/i18n/de.js';
import fr from '../js/i18n/fr.js';
import es from '../js/i18n/es.js';
import pt from '../js/i18n/pt.js';

const messages = { en, de, fr, es, pt };

function flatten(object, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value, path, out);
    else out[path] = value;
  }
  return out;
}

const flat = Object.fromEntries(Object.entries(messages).map(([code, tree]) => [code, flatten(tree)]));
const placeholders = (text) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
const pluralForms = (text) => text.split('|').length;

describe('messages', () => {
  test('a message module exists for every language', () => {
    expect(Object.keys(messages).sort()).toEqual([...LANGUAGE_CODES].sort());
  });

  for (const code of LANGUAGE_CODES.filter((c) => c !== 'en')) {
    test(`${code} has exactly the keys of en`, () => {
      const missing = Object.keys(flat.en).filter((key) => !(key in flat[code]));
      const extra = Object.keys(flat[code]).filter((key) => !(key in flat.en));
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });

    test(`${code} uses the same placeholders and plural forms as en`, () => {
      const mismatches = Object.keys(flat.en)
        .filter((key) => typeof flat[code][key] === 'string')
        .filter((key) =>
          placeholders(flat.en[key]).join() !== placeholders(flat[code][key]).join() ||
          pluralForms(flat.en[key]) !== pluralForms(flat[code][key]));
      expect(mismatches).toEqual([]);
    });
  }

  for (const code of LANGUAGE_CODES) {
    test(`${code} has no empty texts and no unsupported syntax`, () => {
      const bad = Object.entries(flat[code])
        .filter(([, value]) => typeof value !== 'string' || value.trim() === '' || value.includes('@'))
        .map(([key]) => key);
      expect(bad).toEqual([]);
    });
  }
});

describe('catalog texts', () => {
  test('every plant has a name and every care rule a text in English', async () => {
    const { PLANTS } = await import('../js/data/plants.js');
    const { FAMILY_IDS } = await import('../js/data/families.js');
    const missing = [];
    for (const plant of PLANTS) {
      if (!(`plants.${plant.id}` in flat.en)) missing.push(`plants.${plant.id}`);
      for (const rule of plant.care) {
        if (!(`careHints.${plant.id}.${rule.hint}` in flat.en)) missing.push(`careHints.${plant.id}.${rule.hint}`);
      }
    }
    for (const family of FAMILY_IDS) if (!(`families.${family}` in flat.en)) missing.push(`families.${family}`);
    expect(missing).toEqual([]);
  });
});
