// Dashboard (docs/concept.md §2): what is due this month, what can be sown or planted
// now, and a short summary of the garden.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { gardens } from '../stores/gardens.js';
import { catalog, plantLabel } from '../stores/catalog.js';
import { hintsFor, suggestions, TASK_TYPES } from '../logic/hints.js';
import { todayIso, toIsoDate, addDays, yearOf } from '../logic/dates.js';
import { isActiveOn } from '../logic/plantings.js';
import { shoppingList } from '../logic/seeds.js';
import { measure } from '../logic/elements.js';
import { formatArea } from '../logic/units.js';
import { settings } from '../stores/settings.js';
import { presetOf } from '../logic/climate.js';
import { overdueHints } from '../logic/tasks.js';
import { needsBackup, exportGardenFile } from '../services/backup.js';
import { showToast, showError } from '../stores/toast.js';
import AppIcon from '../components/AppIcon.js';
import PlantIcon from '../components/PlantIcon.js';
import EmptyState from '../components/EmptyState.js';
import HintItem from '../components/tasks/HintItem.js';
import WeatherCard from '../components/WeatherCard.js';
import { TASK_ICONS } from '../components/tasks/taskText.js';

export default {
  name: 'DashboardView',
  components: { PlantIcon, AppIcon, EmptyState, HintItem, WeatherCard },
  setup() {
    const { t, locale } = useI18n();
    const garden = computed(() => gardens.active);
    const today = todayIso();
    const month = computed(() => {
      const year = yearOf(today);
      const index = Number(today.slice(5, 7));
      const from = toIsoDate(year, index, 1);
      const to = addDays(toIsoDate(index === 12 ? year + 1 : year, index === 12 ? 1 : index + 1, 1), -1);
      const name = new Intl.DateTimeFormat(locale.value, { month: 'long', timeZone: 'UTC' }).format(new Date(`${from}T00:00:00Z`));
      return { from, to, name };
    });

    const hints = computed(() => (garden.value ? hintsFor(garden.value, catalog.value, month.value) : []));
    const overdue = computed(() => {
      if (!garden.value) return [];
      const recent = hintsFor(garden.value, catalog.value, { from: addDays(today, -30), to: addDays(today, -1) });
      return overdueHints(recent, garden.value.taskStates, today);
    });
    const overdueKeys = computed(() => new Set(overdue.value.map((hint) => hint.key)));
    const backupDue = computed(() => (garden.value ? needsBackup(garden.value) : false));

    function backup() {
      try {
        exportGardenFile(garden.value.id);
        showToast('gardens.exported');
      } catch {
        showError('gardens.loadError', { name: garden.value.name });
      }
    }
    // Overdue tasks are listed separately, not again under their type
    const groups = computed(() => TASK_TYPES
      .map((type) => ({ type, hints: hints.value.filter((hint) => hint.type === type && !overdueKeys.value.has(hint.key)) }))
      .filter((group) => group.hints.length));

    const suggested = computed(() => {
      if (!garden.value) return [];
      const list = suggestions(catalog.value, garden.value.climate, month.value);
      return ['sowIndoor', 'sowOutdoor', 'plantOut']
        .map((kind) => ({
          kind,
          plants: list.filter((entry) => entry.kinds.includes(kind))
            .map((entry) => ({ id: entry.plant.id, name: plantLabel(entry.plant, t), color: entry.plant.color }))
            .sort((a, b) => a.name.localeCompare(b.name, locale.value)),
        }))
        .filter((group) => group.plants.length);
    });

    const summary = computed(() => {
      const g = garden.value;
      if (!g) return null;
      const beds = g.elements.filter((element) => element.type === 'bed');
      return {
        beds: beds.length,
        bedArea: formatArea(beds.reduce((sum, bed) => sum + measure(bed).area, 0), settings.units, locale.value),
        growing: g.plantings.filter((planting) => isActiveOn(planting, today)).length,
        planned: g.plantings.filter((planting) => planting.start > today).length,
        seedsToBuy: shoppingList(g, catalog.value, today).seeds.filter((item) => item.missing > 0).length,
        trees: g.elements.filter((element) => (element.type === 'tree' || element.type === 'shrub')).length,
        climate: presetOf(g.climate.shiftWeeks),
        south: g.climate.hemisphere === 'south',
      };
    });

    return { t, garden, month, hints, groups, overdue, backupDue, backup, suggested, summary, TASK_ICONS };
  },
  template: `
    <div class="page">
      <div class="page-header">
        <h1>{{ garden ? t('dashboard.title', { month: month.name }) : t('nav.dashboard') }}</h1>
      </div>

      <EmptyState v-if="!garden" :title="t('placeholder.noGardenTitle')" :text="t('placeholder.noGardenText')">
        <router-link to="/gardens" class="btn btn-primary">
          <AppIcon name="garden" />
          <span>{{ t('placeholder.toGardens') }}</span>
        </router-link>
      </EmptyState>

      <div v-else class="dashboard-grid">
        <section class="card dashboard-tasks" aria-labelledby="dashboard-due">
          <div class="card-header">
            <AppIcon name="calendar" />
            <h2 id="dashboard-due">{{ t('dashboard.due', { month: month.name }) }}</h2>
          </div>
          <div v-if="overdue.length" class="task-group">
            <h3 class="task-group-title overdue-title">
              <AppIcon name="alert" />
              {{ t('tasks.overdueTitle') }}
              <span class="muted small">({{ overdue.length }})</span>
            </h3>
            <ul class="plain-list hint-list">
              <li v-for="hint in overdue" :key="hint.key"><HintItem :hint="hint" :garden="garden" overdue /></li>
            </ul>
          </div>
          <template v-if="groups.length">
            <div v-for="group in groups" :key="group.type" class="task-group">
              <h3 class="task-group-title" :class="'task-' + group.type">
                <span class="task-icon is-small"><AppIcon :name="TASK_ICONS[group.type]" /></span>
                {{ t('hints.types.' + group.type) }}
                <span class="muted small">({{ group.hints.length }})</span>
              </h3>
              <ul class="plain-list hint-list">
                <li v-for="hint in group.hints" :key="hint.key"><HintItem :hint="hint" :garden="garden" /></li>
              </ul>
            </div>
          </template>
          <div v-else class="muted">
            <p>{{ garden.plantings.length || summary.trees ? t('dashboard.nothingDue') : t('dashboard.noPlantings') }}</p>
            <router-link to="/map" class="btn btn-secondary dashboard-cta">
              <AppIcon name="map" />
              <span>{{ t('dashboard.toMap') }}</span>
            </router-link>
          </div>
        </section>

        <WeatherCard :garden="garden" />

        <section v-if="backupDue" class="card backup-card" aria-labelledby="dashboard-backup">
          <div class="card-header">
            <AppIcon name="download" />
            <h2 id="dashboard-backup">{{ t('dashboard.backupTitle') }}</h2>
          </div>
          <p class="small">{{ t('dashboard.backupText') }}</p>
          <div class="btn-row">
            <button type="button" class="btn btn-primary" @click="backup">
              <AppIcon name="download" />
              <span>{{ t('dashboard.backupNow') }}</span>
            </button>
          </div>
        </section>

        <section class="card" aria-labelledby="dashboard-suggestions">
          <div class="card-header">
            <AppIcon name="seed" />
            <h2 id="dashboard-suggestions">{{ t('dashboard.sowNow', { month: month.name }) }}</h2>
          </div>
          <p v-if="!suggested.length" class="muted">{{ t('dashboard.nothingToSow') }}</p>
          <div v-for="group in suggested" :key="group.kind" class="suggestion-group">
            <h3 class="small">{{ t('plantsView.windows.' + group.kind) }}</h3>
            <ul class="plain-list chip-list">
              <li v-for="plant in group.plants" :key="plant.id">
                <router-link class="plant-chip" :to="'/plants/' + plant.id">
                  <PlantIcon :plant-id="plant.id" :size="22" />{{ plant.name }}
                </router-link>
              </li>
            </ul>
          </div>
        </section>

        <section class="card" aria-labelledby="dashboard-garden">
          <div class="card-header">
            <AppIcon name="garden" />
            <h2 id="dashboard-garden">{{ garden.name }}</h2>
          </div>
          <dl class="measure-list">
            <div><dt>{{ t('dashboard.beds') }}</dt><dd>{{ summary.beds }} · {{ summary.bedArea }}</dd></div>
            <div><dt>{{ t('dashboard.growing') }}</dt><dd>{{ summary.growing }}</dd></div>
            <div><dt>{{ t('dashboard.planned') }}</dt><dd>{{ summary.planned }}</dd></div>
            <div><dt>{{ t('dashboard.trees') }}</dt><dd>{{ summary.trees }}</dd></div>
            <div><dt>{{ t('dashboard.seedsToBuy') }}</dt><dd><router-link to="/seeds">{{ t('seeds.plants', { count: summary.seedsToBuy }, summary.seedsToBuy) }}</router-link></dd></div>
          </dl>
          <p class="small muted">
            {{ t('dashboard.climate', { climate: t('climate.presets.' + summary.climate) }) }}<span v-if="summary.south"> · {{ t('climate.south') }}</span>
            · <router-link to="/settings">{{ t('dashboard.changeClimate') }}</router-link>
          </p>
        </section>
      </div>
    </div>
  `,
};
