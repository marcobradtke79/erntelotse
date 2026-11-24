// Hash-mode routing (works on GitHub Pages without server rewrites).

import { createRouter, createWebHashHistory } from 'vue-router';
import { gardens } from './stores/gardens.js';
import GardensView from './views/GardensView.js';
import SettingsView from './views/SettingsView.js';
import MoreView from './views/MoreView.js';
import MapView from './views/MapView.js';
import BedEditorView from './views/BedEditorView.js';
import DashboardView from './views/DashboardView.js';
import CalendarView from './views/CalendarView.js';
import PlantsView from './views/PlantsView.js';
import PlantDetailView from './views/PlantDetailView.js';
import JournalView from './views/JournalView.js';
import SeedsView from './views/SeedsView.js';
import AboutView from './views/AboutView.js';
import ImprintView from './views/ImprintView.js';
import PrivacyView from './views/PrivacyView.js';

const routes = [
  { path: '/', redirect: () => (gardens.index.length > 0 ? '/dashboard' : '/about') },
  { path: '/about', component: AboutView, meta: { titleKey: 'nav.about' } },
  { path: '/dashboard', component: DashboardView, meta: { titleKey: 'nav.dashboard' } },
  { path: '/map', component: MapView, meta: { titleKey: 'nav.map', fullBleed: true, period: true } },
  // Under /map so that the Map navigation entry stays active
  { path: '/map/bed/:id', component: BedEditorView, meta: { titleKey: 'elements.types.bed', fullBleed: true, period: true } },
  { path: '/calendar', component: CalendarView, meta: { titleKey: 'nav.calendar', period: true } },
  { path: '/plants', component: PlantsView, meta: { titleKey: 'nav.plants' } },
  { path: '/plants/:id', component: PlantDetailView, meta: { titleKey: 'nav.plants' } },
  { path: '/journal', component: JournalView, meta: { titleKey: 'nav.journal', period: true } },
  { path: '/seeds', component: SeedsView, meta: { titleKey: 'nav.seeds' } },
  { path: '/imprint', component: ImprintView, meta: { titleKey: 'legal.imprint' } },
  { path: '/privacy', component: PrivacyView, meta: { titleKey: 'legal.privacy' } },
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
