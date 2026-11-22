import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { PRIMARY_NAV, SECONDARY_NAV } from './navigation.js';
import AppIcon from './components/AppIcon.js';
import GardenSwitcher from './components/GardenSwitcher.js';
import ToastHost from './components/ToastHost.js';

export default {
  name: 'App',
  components: { AppIcon, GardenSwitcher, ToastHost },
  setup() {
    const { t } = useI18n();
    const route = useRoute();
    const main = ref(null);
    const announcement = ref('');

    const pageTitle = computed(() => (route.meta.titleKey ? t(route.meta.titleKey) : ''));
    const moreActive = computed(() => route.path === '/more' || SECONDARY_NAV.some((item) => item.path === route.path));

    watch(pageTitle, (title) => {
      document.title = title ? `${title} · ${t('app.name')}` : t('app.name');
    }, { immediate: true });

    // After navigation: announce the page and move focus to the content
    let first = true;
    watch(() => route.fullPath, async () => {
      if (first) {
        first = false;
        return;
      }
      await nextTick();
      announcement.value = t('a11y.pageOpened', { title: pageTitle.value });
      main.value?.focus({ preventScroll: true });
    });

    function skipToContent() {
      main.value?.focus();
    }

    const fullBleed = computed(() => Boolean(route.meta.fullBleed));

    return { t, main, announcement, moreActive, fullBleed, skipToContent, primary: PRIMARY_NAV, secondary: SECONDARY_NAV };
  },
  template: `
    <div class="app">
      <button type="button" class="btn btn-primary visually-hidden skip-link" @click="skipToContent">{{ t('a11y.skipToContent') }}</button>

      <header class="app-header">
        <router-link to="/" class="app-brand">
          <AppIcon name="sprout" />
          <span>{{ t('app.name') }}</span>
        </router-link>
        <span class="app-header-spacer"></span>
        <GardenSwitcher />
      </header>

      <nav class="app-nav" :aria-label="t('nav.label')">
        <ul>
          <li v-for="item in primary" :key="item.path">
            <router-link :to="item.path" class="nav-link" active-class="active">
              <AppIcon :name="item.icon" />
              <span>{{ t(item.labelKey) }}</span>
            </router-link>
          </li>
          <li v-for="item in secondary" :key="item.path" class="nav-secondary">
            <router-link :to="item.path" class="nav-link" active-class="active">
              <AppIcon :name="item.icon" />
              <span>{{ t(item.labelKey) }}</span>
            </router-link>
          </li>
          <li class="nav-more">
            <router-link to="/more" class="nav-link" :class="{ active: moreActive }" :aria-current="moreActive ? 'page' : null">
              <AppIcon name="more" />
              <span>{{ t('nav.more') }}</span>
            </router-link>
          </li>
        </ul>
      </nav>

      <main id="main" ref="main" class="app-main" :class="{ 'app-main--full': fullBleed }" tabindex="-1">
        <router-view />
      </main>

      <ToastHost />
      <div class="visually-hidden" aria-live="polite">{{ announcement }}</div>
    </div>
  `,
};
