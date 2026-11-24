// Phone only: entries that do not fit into the bottom navigation.

import { useI18n } from 'vue-i18n';
import AppIcon from '../components/AppIcon.js';
import LegalLinks from '../components/LegalLinks.js';
import { ABOUT_NAV, SECONDARY_NAV } from '../navigation.js';

export default {
  name: 'MoreView',
  components: { AppIcon, LegalLinks },
  setup() {
    const { t } = useI18n();
    return { t, items: [ABOUT_NAV, ...SECONDARY_NAV] };
  },
  template: `
    <div class="page">
      <div class="page-header">
        <h1>{{ t('more.title') }}</h1>
      </div>
      <ul class="card plain-list">
        <li v-for="item in items" :key="item.path">
          <router-link :to="item.path" class="menu-item">
            <AppIcon :name="item.icon" />
            <span>{{ t(item.labelKey) }}</span>
          </router-link>
        </li>
      </ul>
      <LegalLinks />
    </div>
  `,
};
