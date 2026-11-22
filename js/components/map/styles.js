// Leaflet path styles per element type, built from the CSS tokens of the current theme.

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function elementStyle(type) {
  switch (type) {
    case 'parcel':
      return { color: token('--map-parcel'), weight: 2, dashArray: '8 6', fill: false };
    case 'bed':
      return { color: token('--map-bed-stroke'), weight: 2, fillColor: token('--map-bed-fill'), fillOpacity: 1 };
    case 'tree':
    case 'shrub':
      return { color: token('--map-canopy-stroke'), weight: 2, fillColor: token('--map-canopy-fill'), fillOpacity: 1 };
    case 'lawn':
      return { stroke: false, fillColor: token('--map-lawn-fill'), fillOpacity: 1 };
    case 'pond':
      return { color: token('--map-pond-stroke'), weight: 2, fillColor: token('--map-pond-fill'), fillOpacity: 1 };
    case 'building':
    case 'greenhouse':
    case 'compost':
      return {
        color: token('--map-building-stroke'),
        weight: 2,
        fillColor: token('--map-building-fill'),
        fillOpacity: 1,
        dashArray: type === 'greenhouse' ? '4 4' : null,
      };
    case 'path':
      return { color: token('--map-path'), opacity: 1, lineCap: 'butt', lineJoin: 'round' };
    case 'fence':
      return { color: token('--map-fence'), opacity: 1, lineCap: 'butt', dashArray: '2 3' };
    case 'hedge':
      return { color: token('--map-hedge'), opacity: 0.85, lineCap: 'round', lineJoin: 'round' };
    default:
      return { color: token('--color-text'), weight: 2 };
  }
}

/** Planting areas and single plants in the plant's colour. */
export function plantingStyle(color, kind) {
  return kind === 'point'
    ? { color, weight: 1.5, fillColor: color, fillOpacity: 0.8, opacity: 1 }
    : { color, weight: 1.5, fillColor: color, fillOpacity: 0.5, opacity: 0.9 };
}

export function selectedStyle() {
  return { color: token('--map-selected'), weight: 3, dashArray: null, stroke: true };
}

export function measureStyle() {
  return { color: token('--map-measure'), weight: 3, dashArray: '6 6' };
}

export function gridColors() {
  return { minor: token('--map-grid-minor'), major: token('--map-grid-major') };
}
