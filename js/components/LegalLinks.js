// Links to the legal notice and the privacy notice (bottom of About and of "More").

import { useI18n } from 'vue-i18n';

export default {
  name: 'LegalLinks',
  setup() {
    const { t } = useI18n();
    return { t };
  },
  template: `
    <nav class="legal-links" :aria-label="t('legal.links')">
      <router-link to="/imprint">{{ t('legal.imprint') }}</router-link>
      <router-link to="/privacy">{{ t('legal.privacy') }}</router-link>
    </nav>
  `,
};
