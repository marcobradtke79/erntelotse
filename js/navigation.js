// Navigation entries. Primary entries are always in the bottom bar on phones;
// secondary entries move into "More" there.

export const PRIMARY_NAV = [
  { path: '/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard' },
  { path: '/map', labelKey: 'nav.map', icon: 'map' },
  { path: '/calendar', labelKey: 'nav.calendar', icon: 'calendar' },
  { path: '/plants', labelKey: 'nav.plants', icon: 'leaf' },
];

export const SECONDARY_NAV = [
  { path: '/journal', labelKey: 'nav.journal', icon: 'book' },
  { path: '/gardens', labelKey: 'nav.gardens', icon: 'garden' },
  { path: '/settings', labelKey: 'nav.settings', icon: 'settings' },
];
