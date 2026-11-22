// Place search with OpenStreetMap Nominatim.
// Usage policy (https://operations.osmfoundation.org/policies/nominatim/):
// at most one request per second, no search-as-you-type, attribution.
// Only the search text and the UI language are sent.

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const MIN_INTERVAL_MS = 1100;

let lastRequest = 0;

export class GeocodeError extends Error {
  constructor(code) {
    super(`Place search failed: ${code}`);
    this.name = 'GeocodeError';
    this.code = code; // offline | failed
  }
}

/** Returns [{ name, lat, lng }] (at most 5). */
export async function searchPlace(query, language) {
  const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequest = Date.now();

  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', 'accept-language': language }).toString();
  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new GeocodeError(navigator.onLine === false ? 'offline' : 'failed');
  }
  if (!response.ok) throw new GeocodeError('failed');
  const results = await response.json();
  return results
    .map((item) => ({ name: item.display_name, lat: Number(item.lat), lng: Number(item.lon) }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}
