// The provider (js/data/provider.js): postal address, contact (e-mail, phone) or both.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { PROVIDER } from '../data/provider.js';

export default {
  name: 'ProviderAddress',
  props: {
    /** 'address' | 'contact' | 'both' */
    part: { type: String, default: 'address' },
  },
  setup() {
    const { t, locale } = useI18n();
    const country = computed(() => new Intl.DisplayNames([locale.value], { type: 'region' }).of(PROVIDER.country));
    const dial = `tel:${PROVIDER.phone.replace(/[^+\d]/g, '')}`;
    return { t, provider: PROVIDER, country, dial };
  },
  template: `
    <address class="provider-address">
      <template v-if="part !== 'contact'">
        <span>{{ provider.name }}</span>
        <span>{{ provider.street }}</span>
        <span>{{ provider.postalCode }} {{ provider.city }}</span>
        <span>{{ country }}</span>
      </template>
      <template v-if="part !== 'address'">
        <span :class="{ 'provider-contact': part === 'both' }">{{ t('legal.imprintPage.email') }}: <a :href="'mailto:' + provider.email">{{ provider.email }}</a></span>
        <span>{{ t('legal.imprintPage.phone') }}: <a :href="dial">{{ provider.phone }}</a></span>
      </template>
    </address>
  `,
};
