// Unit conversion and formatting. Stored values are always metric
// (metres, square metres, kilograms, °C, mm); conversion happens only here.
// Pure module: no Vue, DOM or storage access.

export const UNIT_SYSTEMS = ['metric', 'imperial'];

export const M_PER_FT = 0.3048;
export const M_PER_IN = 0.0254;
export const M2_PER_SQFT = M_PER_FT * M_PER_FT;
export const KG_PER_LB = 0.45359237;
export const KG_PER_OZ = KG_PER_LB / 16;
export const MM_PER_IN = 25.4;

const formatters = new Map();

function numberFormatter(locale, maxFractionDigits, minFractionDigits = 0) {
  const key = `${locale}|${maxFractionDigits}|${minFractionDigits}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: maxFractionDigits,
      minimumFractionDigits: minFractionDigits,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

export function formatNumber(value, locale, maxFractionDigits = 2) {
  return numberFormatter(locale, maxFractionDigits).format(value);
}

function roundTo(value, step) {
  return Math.round(value / step) * step;
}

// "-0" is never shown
function clean(value) {
  return Object.is(value, -0) ? 0 : value;
}

/** 0.45 → "45 cm", 4.8 → "4.8 m"; imperial 1.4 → "4 ft 7 in", 0.19 → "7½ in" */
export function formatLength(metres, system, locale) {
  if (system === 'imperial') {
    const sign = metres < 0 ? '-' : '';
    const totalInches = roundTo(Math.abs(metres) / M_PER_IN, 0.5);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches - feet * 12;
    const inchText = (value) => {
      const whole = Math.floor(value);
      const half = value - whole >= 0.5;
      if (whole === 0 && half) return '½';
      return `${formatNumber(whole, locale, 0)}${half ? '½' : ''}`;
    };
    if (feet === 0) return `${sign}${inchText(inches)} in`;
    if (inches === 0) return `${sign}${formatNumber(feet, locale, 0)} ft`;
    return `${sign}${formatNumber(feet, locale, 0)} ft ${inchText(inches)} in`;
  }
  const rounded = clean(roundTo(metres, 0.01));
  if (Math.abs(rounded) < 1) return `${formatNumber(clean(Math.round(rounded * 100)), locale, 0)} cm`;
  return `${formatNumber(rounded, locale, 2)} m`;
}

/** 4.8 → "4.8 m²"; imperial → "51.7 sq ft" */
export function formatArea(squareMetres, system, locale) {
  if (system === 'imperial') {
    const sqft = squareMetres / M2_PER_SQFT;
    return `${formatNumber(clean(sqft), locale, Math.abs(sqft) < 100 ? 1 : 0)} sq ft`;
  }
  return `${formatNumber(clean(squareMetres), locale, Math.abs(squareMetres) < 10 ? 2 : 1)} m²`;
}

/** 0.25 → "250 g", 4.5 → "4.5 kg"; imperial 4.5 → "9 lb 15 oz" */
export function formatWeight(kilograms, system, locale) {
  if (system === 'imperial') {
    const totalOunces = Math.round(Math.abs(kilograms) / KG_PER_OZ);
    const sign = kilograms < 0 && totalOunces > 0 ? '-' : '';
    const pounds = Math.floor(totalOunces / 16);
    const ounces = totalOunces - pounds * 16;
    if (pounds === 0) return `${sign}${formatNumber(ounces, locale, 0)} oz`;
    if (ounces === 0) return `${sign}${formatNumber(pounds, locale, 0)} lb`;
    return `${sign}${formatNumber(pounds, locale, 0)} lb ${formatNumber(ounces, locale, 0)} oz`;
  }
  if (Math.abs(kilograms) < 1) return `${formatNumber(clean(Math.round(kilograms * 1000)), locale, 0)} g`;
  return `${formatNumber(clean(kilograms), locale, 2)} kg`;
}

export function celsiusToFahrenheit(celsius) {
  return celsius * 9 / 5 + 32;
}

export function fahrenheitToCelsius(fahrenheit) {
  return (fahrenheit - 32) * 5 / 9;
}

/** 3.4 → "3 °C"; imperial → "38 °F" */
export function formatTemperature(celsius, system, locale) {
  if (system === 'imperial') {
    return `${formatNumber(clean(Math.round(celsiusToFahrenheit(celsius))), locale, 0)} °F`;
  }
  return `${formatNumber(clean(Math.round(celsius)), locale, 0)} °C`;
}

/** Precipitation: 4.2 → "4.2 mm"; imperial → "0.17 in" */
export function formatPrecipitation(mm, system, locale) {
  if (system === 'imperial') return `${formatNumber(mm / MM_PER_IN, locale, 2)} in`;
  return `${formatNumber(mm, locale, 1)} mm`;
}

/** Bytes for storage display: "12 kB", "1.2 MB" */
export function formatBytes(bytes, locale) {
  if (bytes < 1000) return `${formatNumber(bytes, locale, 0)} B`;
  if (bytes < 1000 * 1000) return `${formatNumber(bytes / 1000, locale, bytes < 10000 ? 1 : 0)} kB`;
  return `${formatNumber(bytes / 1e6, locale, 1)} MB`;
}

/**
 * Parses user input with dot or comma as decimal separator.
 * "1,5" → 1.5, "1.234,5" → 1234.5, "1,234.5" → 1234.5, "" or "abc" → null
 */
export function parseNumber(text) {
  if (typeof text === 'number') return Number.isFinite(text) ? text : null;
  if (typeof text !== 'string') return null;
  let s = text.trim().replace(/[\s  ']/g, '');
  if (s === '') return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const group = decimal === '.' ? ',' : '.';
    s = s.split(group).join('').replace(decimal, '.');
  } else if (lastComma !== -1) {
    if (s.indexOf(',') !== lastComma) return null;
    s = s.replace(',', '.');
  } else if (lastDot !== -1 && s.indexOf('.') !== lastDot) {
    return null;
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

/** Unit used in length input fields */
export function lengthInputUnit(system) {
  return system === 'imperial' ? 'ft' : 'm';
}

export function toInputLength(metres, system) {
  return system === 'imperial' ? metres / M_PER_FT : metres;
}

export function fromInputLength(value, system) {
  return system === 'imperial' ? value * M_PER_FT : value;
}

export function weightInputUnit(system) {
  return system === 'imperial' ? 'lb' : 'kg';
}

export function toInputWeight(kilograms, system) {
  return system === 'imperial' ? kilograms / KG_PER_LB : kilograms;
}

export function fromInputWeight(value, system) {
  return system === 'imperial' ? value * KG_PER_LB : value;
}
