// Plant catalog: built-in and custom plants, searchable and filtered by category.

import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { catalog, plantLabel } from '../stores/catalog.js';
import { gardens } from '../stores/gardens.js';
import { CATEGORIES } from '../logic/catalog.js';
import AppIcon from '../components/AppIcon.js';
import PlantFormDialog from '../components/plants/PlantFormDialog.js';

export default {
  name: 'PlantsView',
  components: { AppIcon, PlantFormDialog },
  setup() {
    const { t, locale } = useI18n();
    const router = useRouter();
    const query = ref('');
    const category = ref('all');
    const formOpen = ref(false);

    const plants = computed(() => {
      const text = query.value.trim().toLocaleLowerCase(locale.value);
      return catalog.value.all()
        .map((plant) => ({ plant, name: plantLabel(plant, t) }))
        .filter(({ plant, name }) => (category.value === 'all' || plant.category === category.value) &&
          (!text || name.toLocaleLowerCase(locale.value).includes(text)))
        .sort((a, b) => a.name.localeCompare(b.name, locale.value));
    });

    function created(plant) {
      router.push(`/plants/${plant.id}`);
    }

    return { t, gardens, query, category, CATEGORIES, plants, formOpen, created };
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
      </div>

      <p v-if="!plants.length" class="muted">{{ t('plantsView.noResults') }}</p>
      <ul v-else class="card-grid plain-list plant-grid">
        <li v-for="entry in plants" :key="entry.plant.id">
          <router-link :to="'/plants/' + entry.plant.id" class="card plant-card">
            <span class="plant-swatch is-large" :style="{ background: entry.plant.color }" aria-hidden="true"></span>
            <span class="plant-card-text">
              <strong>{{ entry.name }}</strong>
              <span class="small muted">{{ t('plantCategories.' + entry.plant.category) }}</span>
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
