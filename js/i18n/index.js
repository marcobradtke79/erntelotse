import { createI18n } from 'vue-i18n';
import { FALLBACK_LANGUAGE, LANGUAGE_CODES } from './languages.js';
import en from './en.js';
import de from './de.js';
import fr from './fr.js';
import es from './es.js';
import pt from './pt.js';

export const messages = { en, de, fr, es, pt };

export const i18n = createI18n({
  legacy: false,
  locale: FALLBACK_LANGUAGE,
  fallbackLocale: FALLBACK_LANGUAGE,
  messages,
  missingWarn: false,
  fallbackWarn: false,
});

/** Switches the UI language and the document language. */
export function applyLanguage(code) {
  const language = LANGUAGE_CODES.includes(code) ? code : FALLBACK_LANGUAGE;
  i18n.global.locale.value = language;
  document.documentElement.lang = language;
}
