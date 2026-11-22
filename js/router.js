// Hash-mode routing (works on GitHub Pages without server rewrites).

import { createRouter, createWebHashHistory } from 'vue-router';
import { gardens } from './stores/gardens.js';
import PlaceholderView from './views/PlaceholderView.js';
import GardensView from './views/GardensView.js';
import SettingsView from './views/SettingsView.js';
import MoreView from './views/MoreView.js';
import MapView from './views/MapView.js';

const placeholder = (section) => ({
  path: `/${section}`,
  component: PlaceholderView,
  props: { section },
  meta: { titleKey: `nav.${section}` },
});

const routes = [
  { path: '/', redirect: () => (gardens.index.length > 0 ? '/dashboard' : '/gardens') },
  placeholder('dashboard'),
  { path: '/map', component: MapView, meta: { titleKey: 'nav.map', fullBleed: true } },
  placeholder('calendar'),
  placeholder('plants'),
  placeholder('journal'),
  { path: '/gardens', component: GardensView, meta: { titleKey: 'nav.gardens' } },
  { path: '/settings', component: SettingsView, meta: { titleKey: 'nav.settings' } },
  { path: '/more', component: MoreView, meta: { titleKey: 'more.title' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});
