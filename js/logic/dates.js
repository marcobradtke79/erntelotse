// Calendar dates as ISO strings (YYYY-MM-DD), without time zones. Pure module.
// ISO dates compare correctly as strings.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isIsoDate(value) {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toUtc(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms) {
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function toIsoDate(year, month, day) {
  return fromUtc(Date.UTC(year, month - 1, day));
}

/** Today in the user's local time zone. */
export function todayIso(now = new Date()) {
  return toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function yearOf(iso) {
  return Number(iso.slice(0, 4));
}

export function addDays(iso, days) {
  return fromUtc(toUtc(iso) + days * DAY_MS);
}

export function daysBetween(from, to) {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** Same day in another year; 29 February becomes 28 February in common years. */
export function addYears(iso, years) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = y + years;
  const lastDay = new Date(Date.UTC(target, m, 0)).getUTCDate();
  return toIsoDate(target, m, Math.min(d, lastDay));
}

export function withYear(iso, year) {
  return addYears(iso, year - yearOf(iso));
}

export function daysInYear(year) {
  return new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
}

/** 1 for 1 January */
export function dayOfYear(iso) {
  return daysBetween(`${iso.slice(0, 4)}-01-01`, iso) + 1;
}

export function fromDayOfYear(year, day) {
  return addDays(toIsoDate(year, 1, 1), day - 1);
}

export function minDate(a, b) {
  return a <= b ? a : b;
}

export function maxDate(a, b) {
  return a >= b ? a : b;
}
