// Plant catalog: built-in and custom plants, searchable and filtered by category and by
// their use in the garden (grown this year, planned for the time ahead).

import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { catalog, plantLabel } from '../stores/catalog.js';
import { gardens } from '../stores/gardens.js';
import { CATEGORIES } from '../logic/catalog.js';
import { plantUse } from '../logic/plantings.js';
import { todayIso, yearOf } from '../logic/dates.js';
import { shortDate } from '../components/tasks/taskText.js';
import AppIcon from '../components/AppIcon.js';
import PlantIcon from '../components/PlantIcon.js';
import PlantFormDialog from '../components/plants/PlantFormDialog.js';

export default {
  name: 'PlantsView',
  components: { PlantIcon, AppIcon, PlantFormDialog },
  setup() {
    const { t, locale } = useI18n();
    const router = useRouter();
    const query = ref('');
    const category = ref('all');
    const formOpen = ref(false);
    const usage = ref('all');
    const today = todayIso();
    const year = yearOf(today);
    const use = computed(() => (gardens.active ? plantUse(gardens.active, today) : new Map()));
    const USAGE_FILTERS = ['all', 'used', 'planned'];
    const matchesUsage = (entry) => usage.value === 'all' || (usage.value === 'used' ? entry.used : Boolean(entry.planned));

    const plants = computed(() => {
      const text = query.value.trim().toLocaleLowerCase(locale.value);
      return catalog.value.all()
        .map((plant) => {
          const own = use.value.get(plant.id);
          return {
            plant,
            name: plantLabel(plant, t),
            used: Boolean(own?.usedThisYear),
            // with the year when the planting starts in another one
            planned: own?.firstPlanned ? (yearOf(own.firstPlanned) === year ? shortDate(own.firstPlanned, locale.value) : `${shortDate(own.firstPlanned, locale.value)} ${yearOf(own.firstPlanned)}`) : null,
          };
        })
        .filter((entry) => (category.value === 'all' || entry.plant.category === category.value) &&
          (!text || entry.name.toLocaleLowerCase(locale.value).includes(text)) && matchesUsage(entry))
        .sort((a, b) => a.name.localeCompare(b.name, locale.value));
    });

    function created(plant) {
      router.push(`/plants/${plant.id}`);
    }

    const usageLabel = (value) => (value === 'all' ? t('plantsView.all') : value === 'used' ? t('plantsView.usedYear', { year }) : t('plantsView.planned'));

    return { t, gardens, query, category, CATEGORIES, plants, formOpen, created, usage, USAGE_FILTERS, usageLabel, year };
  },
  template: `
    <div class="page">
      <div class="page-header">
        <h1>{{ t('nav.plants') }}</h1>
        <button v-if="gardens.active" type="button" class="btn btn-primary" @click="formOpen = true">
          <AppIcon name="plus" />
          <span>{{ t('plantsView.newPlant') }}</span>
        </button>
      </div>

      <div class="plants-filter">
        <div class="field">
          <label for="plant-search" class="visually-hidden">{{ t('plantsView.search') }}</label>
          <input id="plant-search" v-model="query" class="input" type="search" :placeholder="t('plantsView.search')" autocomplete="off" />
        </div>
        <div class="choice-group" role="radiogroup" :aria-label="t('plantsView.category')">
          <label class="choice">
            <input type="radio" name="plant-category" value="all" v-model="category" />
            <span>{{ t('plantsView.all') }}</span>
          </label>
          <label class="choice" v-for="item in CATEGORIES" :key="item">
            <input type="radio" name="plant-category" :value="item" v-model="category" />
            <span>{{ t('plantCategories.' + item) }}</span>
          </label>
        </div>
        <div v-if="gardens.active" class="choice-group" role="radiogroup" :aria-label="t('plantsView.usage')">
          <label class="choice" v-for="item in USAGE_FILTERS" :key="item">
            <input type="radio" name="plant-usage" :value="item" v-model="usage" />
            <span>{{ usageLabel(item) }}</span>
          </label>
        </div>
      </div>

      <p v-if="!plants.length" class="muted">{{ t('plantsView.noResults') }}</p>
      <ul v-else class="card-grid plain-list plant-grid">
        <li v-for="entry in plants" :key="entry.plant.id">
          <router-link :to="'/plants/' + entry.plant.id" class="card plant-card">
            <PlantIcon :plant-id="entry.plant.id" :size="40" />
            <span class="plant-card-text">
              <strong>{{ entry.name }}</strong>
              <span class="small muted">{{ t('plantCategories.' + entry.plant.category) }}</span>
              <span v-if="entry.used || entry.planned" class="plant-card-use">
                <span v-if="entry.used" class="status-chip is-active">{{ t('plantsView.usedYear', { year }) }}</span>
                <span v-if="entry.planned" class="status-chip is-planned">{{ t('plantsView.plannedFrom', { date: entry.planned }) }}</span>
              </span>
            </span>
            <span v-if="entry.plant.custom" class="badge">{{ t('plantsView.custom') }}</span>
            <span v-else-if="entry.plant.overridden" class="badge">{{ t('plantsView.changed') }}</span>
          </router-link>
        </li>
      </ul>

      <PlantFormDialog v-model:open="formOpen" @saved="created" />
    </div>
  `,
};
