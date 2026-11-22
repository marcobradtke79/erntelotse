// Weather forecast from Open-Meteo (https://open-meteo.com, free, no API key).
// Only used when weather is switched on and the garden has a location. Coordinates are
// rounded to about 1 km. The forecast is cached per garden; offline a cached forecast of
// the last 24 hours is used, otherwise nothing is shown.

import { parseForecast } from '../logic/weatherRules.js';

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
export const MAX_AGE_MS = 3 * 60 * 60 * 1000; // refetch after 3 hours
export const MAX_STALE_MS = 24 * 60 * 60 * 1000; // offline: older forecasts are not shown

const round = (value) => Math.round(value * 100) / 100;

export function forecastUrl(location) {
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    latitude: round(location.lat),
    longitude: round(location.lng),
    daily: 'temperature_2m_min,temperature_2m_max,precipitation_sum',
    past_days: '3',
    forecast_days: '7',
    timezone: 'auto',
  }).toString();
  return url;
}

/**
 * Forecast for a garden: { days, fetchedAt, fromCache, stale } or null when there is none.
 * stale: the request failed and an older cached forecast is returned.
 * @param storage the storage service (readWeather / writeWeather)
 * @param fetchFn injectable for tests
 */
export async function loadWeather(gardenId, location, storage, { now = Date.now(), fetchFn = globalThis.fetch } = {}) {
  const cached = storage.readWeather(gardenId);
  const sameSpot = cached && cached.lat === round(location.lat) && cached.lng === round(location.lng);
  if (sameSpot && now - cached.fetchedAt < MAX_AGE_MS) return { ...cached, fromCache: true, stale: false };
  try {
    const response = await fetchFn(forecastUrl(location));
    if (!response.ok) throw new Error(`Forecast request failed: ${response.status}`);
    const entry = { lat: round(location.lat), lng: round(location.lng), fetchedAt: now, days: parseForecast(await response.json()) };
    try {
      storage.writeWeather(gardenId, entry);
    } catch {
      // a full storage must not hide the forecast
    }
    return { ...entry, fromCache: false, stale: false };
  } catch {
    // Offline or service unavailable: an older forecast is better than none
    return sameSpot && now - cached.fetchedAt < MAX_STALE_MS ? { ...cached, fromCache: true, stale: true } : null;
  }
}
