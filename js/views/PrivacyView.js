// Privacy notice (GDPR Art. 13): what stays on the device, hosting, the three external services.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { PRIVACY_DATE } from '../data/provider.js';
import AppIcon from '../components/AppIcon.js';
import ProviderAddress from '../components/ProviderAddress.js';
import LegalLinks from '../components/LegalLinks.js';

const SERVICES = ['osm', 'nominatim', 'weather'];

export default {
  name: 'PrivacyView',
  components: { AppIcon, ProviderAddress, LegalLinks },
  setup() {
    const { t, locale } = useI18n();
    const date = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${PRIVACY_DATE}T00:00:00Z`)));
    return { t, SERVICES, date };
  },
  template: `
    <div class="page legal-page">
      <div class="page-header">
        <router-link to="/about" class="btn btn-text">
          <AppIcon name="chevron-left" />
          <span>{{ t('nav.about') }}</span>
        </router-link>
      </div>
      <h1>{{ t('legal.privacy') }}</h1>

      <section class="card" aria-labelledby="privacy-device">
        <h2 id="privacy-device">{{ t('legal.privacyPage.deviceTitle') }}</h2>
        <p>{{ t('legal.privacyPage.device1') }}</p>
        <p>{{ t('legal.privacyPage.device2') }}</p>
      </section>

      <section class="card" aria-labelledby="privacy-hosting">
        <h2 id="privacy-hosting">{{ t('legal.privacyPage.hostingTitle') }}</h2>
        <p>{{ t('legal.privacyPage.hostingText') }}</p>
      </section>

      <section class="card" aria-labelledby="privacy-services">
        <h2 id="privacy-services">{{ t('legal.privacyPage.servicesTitle') }}</h2>
        <p>{{ t('legal.privacyPage.servicesIntro') }}</p>
        <ul>
          <li v-for="service in SERVICES" :key="service">{{ t('legal.privacyPage.' + service) }}</li>
        </ul>
      </section>

      <section class="card" aria-labelledby="privacy-rights">
        <h2 id="privacy-rights">{{ t('legal.privacyPage.rightsTitle') }}</h2>
        <p>{{ t('legal.privacyPage.rightsText') }}</p>
        <p>{{ t('legal.privacyPage.complaint') }}</p>
      </section>

      <section class="card" aria-labelledby="privacy-controller">
        <h2 id="privacy-controller">{{ t('legal.privacyPage.controllerTitle') }}</h2>
        <p>{{ t('legal.privacyPage.controllerText') }}</p>
        <ProviderAddress part="both" />
      </section>

      <p class="small muted">{{ t('legal.privacyPage.updated', { date }) }} · {{ t('legal.german') }}</p>
      <LegalLinks />
    </div>
  `,
};
