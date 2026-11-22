// Loads Leaflet and Leaflet-Geoman on first use. They are classic scripts that
// define the global `L`, so they cannot be imported as ES modules.

const vendor = (path) => new URL(`../../vendor/${path}`, import.meta.url).href;

function loadStyle(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = resolve;
    link.onerror = () => reject(new Error(`Cannot load ${href}`));
    // Before our own styles, so they can override Leaflet's
    document.head.querySelector('link[rel="stylesheet"]')?.before(link) ?? document.head.append(link);
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Cannot load ${src}`));
    document.head.append(script);
  });
}

let loading = null;

/** Resolves to the Leaflet namespace `L` with Geoman installed. */
export function loadLeaflet() {
  loading ??= (async () => {
    await Promise.all([
      loadStyle(vendor('leaflet/leaflet.css')),
      loadStyle(vendor('leaflet-geoman/leaflet-geoman.css')),
    ]);
    await loadScript(vendor('leaflet/leaflet.js'));
    await loadScript(vendor('leaflet-geoman/leaflet-geoman.min.js'));
    return globalThis.L;
  })().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}
