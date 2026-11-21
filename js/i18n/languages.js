// Supported languages. Pure module (used by logic, stores and tests).
// Language names are shown in their own language, so they are not translated.

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
];

export const LANGUAGE_CODES = LANGUAGES.map((language) => language.code);

export const FALLBACK_LANGUAGE = 'en';

/** First supported language from the browser's preference list, matched by primary subtag. */
export function detectLanguage(preferred = []) {
  for (const tag of preferred) {
    if (typeof tag !== 'string') continue;
    const primary = tag.toLowerCase().split(/[-_]/)[0];
    if (LANGUAGE_CODES.includes(primary)) return primary;
  }
  return FALLBACK_LANGUAGE;
}
