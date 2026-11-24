import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { ABOUT_NAV, PRIMARY_NAV, SECONDARY_NAV } from './navigation.js';
import AppIcon from './components/AppIcon.js';
import GardenSwitcher from './components/GardenSwitcher.js';
import YearSwitcher from './components/YearSwitcher.js';
import { gardens } from './stores/gardens.js';
import ToastHost from './components/ToastHost.js';

export default {
  name: 'App',
  components: { AppIcon, GardenSwitcher, YearSwitcher, ToastHost },
  setup() {
    const { t } = useI18n();
    const route = useRoute();
    const main = ref(null);
    const announcement = ref('');

    const pageTitle = computed(() => (route.meta.titleKey ? t(route.meta.titleKey) : ''));
    const moreActive = computed(() => route.path === '/more' || [ABOUT_NAV.path, '/imprint', '/privacy'].includes(route.path) || SECONDARY_NAV.some((item) => item.path === route.path));

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
    // By path, so that /map/bed/:id keeps "Map" highlighted
    const isActive = (path) => route.path === path || route.path.startsWith(`${path}/`);
    const showPeriod = computed(() => Boolean(route.meta.period) && Boolean(gardens.active));

    return { t, main, announcement, moreActive, fullBleed, showPeriod, isActive, skipToContent, about: ABOUT_NAV, primary: PRIMARY_NAV, secondary: SECONDARY_NAV };
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
        <YearSwitcher v-if="showPeriod" />
        <GardenSwitcher />
      </header>

      <nav class="app-nav" :aria-label="t('nav.label')">
        <ul>
          <li class="nav-secondary">
            <router-link :to="about.path" class="nav-link" :class="{ active: isActive(about.path) }" :aria-current="isActive(about.path) ? 'page' : null">
              <AppIcon :name="about.icon" />
              <span>{{ t(about.labelKey) }}</span>
            </router-link>
          </li>
          <li v-for="item in primary" :key="item.path">
            <router-link :to="item.path" class="nav-link" :class="{ active: isActive(item.path) }" :aria-current="isActive(item.path) ? 'page' : null">
              <AppIcon :name="item.icon" />
              <span>{{ t(item.labelKey) }}</span>
            </router-link>
          </li>
          <li v-for="item in secondary" :key="item.path" class="nav-secondary">
            <router-link :to="item.path" class="nav-link" :class="{ active: isActive(item.path) }" :aria-current="isActive(item.path) ? 'page' : null">
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
