import { describe, test, expect } from './harness.js';
import { weatherNotes, parseForecast } from '../js/logic/weatherRules.js';
import { loadWeather, forecastUrl, MAX_AGE_MS, MAX_STALE_MS } from '../js/services/weather.js';
import { createGarden } from '../js/logic/gardenModel.js';
import { createPlanting } from '../js/logic/plantings.js';
import { buildCatalog } from '../js/logic/catalog.js';
import { PLANTS } from '../js/data/plants.js';

const catalog = buildCatalog(PLANTS);
const TODAY = '2026-05-20';

/** Days from 3 days before TODAY, with defaults overridden per date. */
function days(overrides = {}) {
  const list = [];
  for (let i = -3; i < 7; i++) {
    const date = new Date(Date.UTC(2026, 4, 20 + i)).toISOString().slice(0, 10);
    list.push({ date, tMin: 8, tMax: 18, rain: 0, ...overrides[date] });
  }
  return list;
}

function gardenWith(...plantings) {
  const garden = createGarden({ name: 'Test', now: new Date('2026-01-01T00:00:00Z') });
  garden.plantings.push(...plantings.map(([plantId, start, end]) => createPlanting({ bedId: 'e_bed1', plantId, shape: { kind: 'point', at: [1, 1] }, start, end })));
  return garden;
}

describe('weather rules', () => {
  test('frost below 0 °C with tomatoes planted out (acceptance)', () => {
    const garden = gardenWith(['tomato', '2026-05-15', '2026-10-01'], ['carrot', '2026-04-01', '2026-08-01']);
    const notes = weatherNotes({ days: days({ '2026-05-22': { tMin: -1.5 } }), garden, catalog, today: TODAY });
    expect(notes[0]).toEqual({ kind: 'frost', date: '2026-05-22', tMin: -1.5, plantIds: ['tomato'] });
  });
  test('frost also warns for tender plants about to be planted', () => {
    const garden = gardenWith(['zucchini', '2026-05-25', '2026-09-30']);
    const notes = weatherNotes({ days: days({ '2026-05-21': { tMin: 0.5 } }), garden, catalog, today: TODAY });
    expect(notes[0].plantIds).toEqual(['zucchini']);
  });
  test('no frost warning for hardy plants or without frost', () => {
    const hardy = gardenWith(['carrot', '2026-04-01', '2026-08-01']);
    expect(weatherNotes({ days: days({ '2026-05-22': { tMin: -2 } }), garden: hardy, catalog, today: TODAY }).some((n) => n.kind === 'frost')).toBeFalsy();
    const tender = gardenWith(['tomato', '2026-05-15', '2026-10-01']);
    expect(weatherNotes({ days: days(), garden: tender, catalog, today: TODAY })).toEqual([]);
  });
  test('frost in the past does not count', () => {
    const garden = gardenWith(['tomato', '2026-05-15', '2026-10-01']);
    expect(weatherNotes({ days: days({ '2026-05-18': { tMin: -3 } }), garden, catalog, today: TODAY })).toEqual([]);
  });
  test('watering hint in a dry warm spell, none after rain', () => {
    const garden = gardenWith(['carrot', '2026-04-01', '2026-08-01']);
    const hot = { '2026-05-20': { tMax: 27 }, '2026-05-21': { tMax: 29 } };
    expect(weatherNotes({ days: days(hot), garden, catalog, today: TODAY })).toEqual([{ kind: 'water', hotDays: 2 }]);
    const rained = { ...hot, '2026-05-18': { rain: 7 }, '2026-05-19': { rain: 6 } };
    expect(weatherNotes({ days: days(rained), garden, catalog, today: TODAY })).toEqual([{ kind: 'rained', mm: 13 }]);
  });
  test('no watering notes when nothing grows', () => {
    const garden = gardenWith(['carrot', '2026-07-01', '2026-10-01']);
    expect(weatherNotes({ days: days({ '2026-05-20': { tMax: 30 }, '2026-05-21': { tMax: 30 } }), garden, catalog, today: TODAY })).toEqual([]);
  });
  test('Open-Meteo response is parsed, missing values become null', () => {
    const parsed = parseForecast({ daily: { time: ['2026-05-20', '2026-05-21'], temperature_2m_min: [3.1, null], temperature_2m_max: [15, 16], precipitation_sum: [0.4, 2] } });
    expect(parsed).toEqual([{ date: '2026-05-20', tMin: 3.1, tMax: 15, rain: 0.4 }, { date: '2026-05-21', tMin: null, tMax: 16, rain: 2 }]);
    expect(() => parseForecast({ error: true })).toThrow();
  });
});

describe('weather service cache', () => {
  const location = { lat: 52.520008, lng: 13.404954 };
  const response = { daily: { time: ['2026-05-20'], temperature_2m_min: [5], temperature_2m_max: [15], precipitation_sum: [0] } };
  const fakeStorage = () => {
    const map = new Map();
    return { readWeather: (id) => map.get(id) ?? null, writeWeather: (id, value) => map.set(id, value), map };
  };
  const fakeFetch = (ok = true) => {
    const calls = [];
    const fn = async (url) => {
      calls.push(String(url));
      if (ok === 'offline') throw new TypeError('Failed to fetch');
      return { ok, status: ok ? 200 : 500, json: async () => response };
    };
    fn.calls = calls;
    return fn;
  };

  test('position is rounded to about 1 km', () => {
    const url = forecastUrl(location);
    expect(url.searchParams.get('latitude')).toBe('52.52');
    expect(url.searchParams.get('longitude')).toBe('13.4');
  });
  test('fetches, stores, then serves from cache until it is too old', async () => {
    const storage = fakeStorage();
    const fetchFn = fakeFetch();
    const first = await loadWeather('g_1', location, storage, { now: 1000, fetchFn });
    expect(first.fromCache).toBe(false);
    expect(first.days[0].tMax).toBe(15);
    const second = await loadWeather('g_1', location, storage, { now: 1000 + MAX_AGE_MS - 1, fetchFn });
    expect(second.fromCache).toBe(true);
    expect(fetchFn.calls.length).toBe(1);
    await loadWeather('g_1', location, storage, { now: 1000 + MAX_AGE_MS, fetchFn });
    expect(fetchFn.calls.length).toBe(2);
  });
  test('another position is fetched again', async () => {
    const storage = fakeStorage();
    const fetchFn = fakeFetch();
    await loadWeather('g_1', location, storage, { now: 1000, fetchFn });
    await loadWeather('g_1', { lat: 48.1, lng: 11.6 }, storage, { now: 2000, fetchFn });
    expect(fetchFn.calls.length).toBe(2);
  });
  test('offline: older forecast of the last day, otherwise nothing', async () => {
    const storage = fakeStorage();
    await loadWeather('g_1', location, storage, { now: 0, fetchFn: fakeFetch() });
    const stale = await loadWeather('g_1', location, storage, { now: MAX_AGE_MS + 1, fetchFn: fakeFetch('offline') });
    expect(stale.stale).toBe(true);
    expect(await loadWeather('g_1', location, storage, { now: MAX_STALE_MS, fetchFn: fakeFetch('offline') })).toBeNull();
    expect(await loadWeather('g_2', location, storage, { now: 0, fetchFn: fakeFetch('offline') })).toBeNull();
  });
  test('server errors are silent', async () => {
    expect(await loadWeather('g_1', location, fakeStorage(), { now: 0, fetchFn: fakeFetch(false) })).toBeNull();
  });
});
