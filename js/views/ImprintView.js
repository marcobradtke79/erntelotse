// Legal notice (Impressum, § 5 DDG and § 18 (2) MStV). Provider details: js/data/provider.js.

import { useI18n } from 'vue-i18n';
import AppIcon from '../components/AppIcon.js';
import ProviderAddress from '../components/ProviderAddress.js';
import LegalLinks from '../components/LegalLinks.js';

const NOTES = ['project', 'hints', 'external'];

export default {
  name: 'ImprintView',
  components: { AppIcon, ProviderAddress, LegalLinks },
  setup() {
    const { t } = useI18n();
    return { t, NOTES };
  },
  template: `
    <div class="page legal-page">
      <div class="page-header">
        <router-link to="/about" class="btn btn-text">
          <AppIcon name="chevron-left" />
          <span>{{ t('nav.about') }}</span>
        </router-link>
      </div>
      <h1>{{ t('legal.imprint') }}</h1>

      <section class="card" aria-labelledby="imprint-provider">
        <h2 id="imprint-provider">{{ t('legal.imprintPage.provider') }}</h2>
        <ProviderAddress />
        <h3>{{ t('legal.imprintPage.contact') }}</h3>
        <ProviderAddress part="contact" />
      </section>

      <section class="card" aria-labelledby="imprint-responsible">
        <h2 id="imprint-responsible">{{ t('legal.imprintPage.responsible') }}</h2>
        <ProviderAddress />
      </section>

      <section class="card" aria-labelledby="imprint-notes">
        <h2 id="imprint-notes">{{ t('legal.imprintPage.notesTitle') }}</h2>
        <p v-for="note in NOTES" :key="note">{{ t('legal.imprintPage.' + note) }}</p>
      </section>

      <p class="small muted">{{ t('legal.german') }}</p>
      <LegalLinks />
    </div>
  `,
};
