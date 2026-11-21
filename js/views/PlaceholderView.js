// Temporary view for features of later milestones (dashboard, map, calendar, plants, journal).

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { gardens } from '../stores/gardens.js';
import AppIcon from '../components/AppIcon.js';
import EmptyState from '../components/EmptyState.js';

export default {
  name: 'PlaceholderView',
  components: { AppIcon, EmptyState },
  props: {
    section: { type: String, required: true },
  },
  setup(props) {
    const { t } = useI18n();
    const hasGarden = computed(() => Boolean(gardens.active));
    const title = computed(() => t(`nav.${props.section}`));
    return { t, gardens, hasGarden, title };
  },
  template: `
    <div class="page">
      <div class="page-header">
        <h1>{{ title }}</h1>
      </div>
      <EmptyState v-if="!hasGarden" :title="t('placeholder.noGardenTitle')" :text="t('placeholder.noGardenText')">
        <router-link to="/gardens" class="btn btn-primary">
          <AppIcon name="garden" />
          <span>{{ t('placeholder.toGardens') }}</span>
        </router-link>
      </EmptyState>
      <EmptyState v-else :title="t('placeholder.comingSoon')" :text="t('placeholder.' + section)" />
    </div>
  `,
};
