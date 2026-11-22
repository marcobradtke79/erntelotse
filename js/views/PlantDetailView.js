// Plant detail: facts, calendar strip (with the garden's climate), care, companions,
// editing, reset of changes, deleting custom plants.

import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { catalog, plantLabel } from '../stores/catalog.js';
import { gardens, plantUsage, deleteCustomPlant, setOverride } from '../stores/gardens.js';
import { settings } from '../stores/settings.js';
import { period } from '../stores/period.js';
import { showToast } from '../stores/toast.js';
import { FAMILIES } from '../data/families.js';
import { formatLength } from '../logic/units.js';
import AppIcon from '../components/AppIcon.js';
import PlantIcon from '../components/PlantIcon.js';
import AppDialog from '../components/AppDialog.js';
import EmptyState from '../components/EmptyState.js';
import PlantCalendarStrip from '../components/plants/PlantCalendarStrip.js';
import PlantFormDialog from '../components/plants/PlantFormDialog.js';
import { TASK_ICONS } from '../components/tasks/taskText.js';

export default {
  name: 'PlantDetailView',
  components: { AppIcon, PlantIcon, AppDialog, EmptyState, PlantCalendarStrip, PlantFormDialog },
  setup() {
    const { t, te, locale } = useI18n();
    const route = useRoute();
    const router = useRouter();
    const plant = computed(() => (catalog.value.has(route.params.id) ? catalog.value.get(route.params.id) : null));
    const name = computed(() => (plant.value ? plantLabel(plant.value, t) : ''));
    const climate = computed(() => gardens.active?.climate ?? { hemisphere: 'north', shiftWeeks: 0 });
    const usage = computed(() => (plant.value ? plantUsage(plant.value.id) : 0));
    const formOpen = ref(false);
    const deleteOpen = ref(false);

    const facts = computed(() => {
      const p = plant.value;
      const length = (value) => formatLength(value, settings.units, locale.value);
      const list = [
        { label: t('plantsView.family'), value: p.family ? `${t(`families.${p.family}`)} (${FAMILIES[p.family]?.latin ?? p.family})` : '–' },
        { label: t('plantsView.form.lifecycle'), value: t(`plantsView.lifecycle.${p.lifecycle}`) },
        { label: t('plantsView.spacing'), value: `${length(p.spacing.row)} × ${length(p.spacing.plant)}` },
      ];
      if (p.growDays) list.push({ label: t('plantsView.growDays'), value: t('plantsView.days', { count: p.growDays }, p.growDays) });
      list.push({ label: t('plantsView.harvestDays'), value: t('plantsView.days', { count: p.harvestDays }, p.harvestDays) });
      if (!p.custom) {
        list.push({ label: t('plantsView.feeder'), value: t(`plantsView.feeders.${p.feeder}`) });
        list.push({ label: t('plantsView.water'), value: t(`plantsView.waterNeeds.${p.water}`) });
      }
      if (p.frostTender) list.push({ label: t('plantsView.frost'), value: t('plantsView.frostTender') });
      return list;
    });

    const care = computed(() => (plant.value?.care ?? []).map((rule) => {
      const key = `careHints.${plant.value.id}.${rule.hint}`;
      return { ...rule, text: te(key) ? t(key) : t(`hints.types.${rule.type}`) };
    }));

    const companions = computed(() => {
      const map = (ids) => ids.filter((id) => catalog.value.has(id)).map((id) => {
        const other = catalog.value.get(id);
        return { id, name: plantLabel(other, t), color: other.color };
      });
      return { good: map(plant.value?.companions.good ?? []), bad: map(plant.value?.companions.bad ?? []) };
    });

    function resetChanges() {
      setOverride(plant.value.id, null);
      showToast('plantsView.resetDone');
    }

    function confirmDelete() {
      deleteOpen.value = false;
      const label = name.value;
      deleteCustomPlant(plant.value.id);
      showToast('plantsView.deleted', { params: { name: label } });
      router.push('/plants');
    }

    return {
      t, plant, name, climate, usage, facts, care, companions, formOpen, deleteOpen, period, gardens, TASK_ICONS,
      resetChanges, confirmDelete,
    };
  },
  template: `
    <div class="page">
      <div class="page-header">
        <router-link to="/plants" class="btn btn-text">
          <AppIcon name="chevron-left" />
          <span>{{ t('nav.plants') }}</span>
        </router-link>
      </div>

      <EmptyState v-if="!plant" :title="t('plantsView.notFoundTitle')" :text="t('plantsView.notFoundText')" />

      <template v-else>
        <div class="plant-hero">
          <PlantIcon :plant-id="plant.id" :size="72" />
          <div>
            <h1>{{ name }}</h1>
            <p class="muted">
              {{ t('plantCategories.' + plant.category) }} · {{ t('plantsView.placement.' + plant.placement) }}
              <span v-if="plant.custom" class="badge">{{ t('plantsView.custom') }}</span>
              <span v-else-if="plant.overridden" class="badge">{{ t('plantsView.changed') }}</span>
            </p>
          </div>
        </div>

        <div class="btn-row" v-if="gardens.active">
          <button type="button" class="btn btn-secondary" @click="formOpen = true">
            <AppIcon name="edit" />
            <span>{{ plant.custom ? t('plantsView.edit') : t('plantsView.adjust') }}</span>
          </button>
          <button v-if="plant.overridden" type="button" class="btn btn-text" @click="resetChanges">{{ t('plantsView.reset') }}</button>
          <button v-if="plant.custom" type="button" class="btn btn-danger-outline" :disabled="usage > 0" @click="deleteOpen = true">
            <AppIcon name="trash" />
            <span>{{ t('common.delete') }}</span>
          </button>
        </div>
        <p v-if="plant.custom && usage > 0" class="small muted">{{ t('plantsView.inUse', { count: usage }, usage) }}</p>

        <div class="plant-detail-grid">
          <section class="card" aria-labelledby="plant-calendar">
            <div class="card-header">
              <AppIcon name="calendar" />
              <h2 id="plant-calendar">{{ t('plantsView.calendar') }}</h2>
            </div>
            <PlantCalendarStrip :plant="plant" :climate="climate" :year="period.year" />
            <p class="small muted">{{ t('plantsView.calendarHint') }}</p>
          </section>

          <section class="card" aria-labelledby="plant-facts">
            <div class="card-header">
              <AppIcon name="info" />
              <h2 id="plant-facts">{{ t('plantsView.facts') }}</h2>
            </div>
            <dl class="measure-list">
              <div v-for="fact in facts" :key="fact.label"><dt>{{ fact.label }}</dt><dd>{{ fact.value }}</dd></div>
            </dl>
          </section>

          <section v-if="care.length" class="card" aria-labelledby="plant-care">
            <div class="card-header">
              <AppIcon name="spade" />
              <h2 id="plant-care">{{ t('plantsView.care') }}</h2>
            </div>
            <ul class="plain-list hint-list">
              <li v-for="rule in care" :key="rule.hint" class="hint-item" :class="'task-' + rule.type">
                <span class="task-icon"><AppIcon :name="TASK_ICONS[rule.type]" :label="t('hints.types.' + rule.type)" /></span>
                <div class="hint-item-body">
                  <p><strong>{{ t('hints.types.' + rule.type) }}</strong></p>
                  <p class="small">{{ rule.text }}</p>
                  <p v-if="rule.everyWeeks" class="small muted">{{ t('hints.every', { count: rule.everyWeeks }, rule.everyWeeks) }}</p>
                </div>
              </li>
            </ul>
          </section>

          <section v-if="companions.good.length || companions.bad.length" class="card" aria-labelledby="plant-companions">
            <div class="card-header">
              <AppIcon name="leaf" />
              <h2 id="plant-companions">{{ t('plantsView.companions') }}</h2>
            </div>
            <div v-if="companions.good.length">
              <h3 class="small companion-title is-good"><AppIcon name="check" />{{ t('plantsView.goodNeighbours') }}</h3>
              <ul class="plain-list chip-list">
                <li v-for="other in companions.good" :key="other.id">
                  <router-link class="plant-chip" :to="'/plants/' + other.id"><PlantIcon :plant-id="other.id" :size="22" />{{ other.name }}</router-link>
                </li>
              </ul>
            </div>
            <div v-if="companions.bad.length">
              <h3 class="small companion-title is-bad"><AppIcon name="close" />{{ t('plantsView.badNeighbours') }}</h3>
              <ul class="plain-list chip-list">
                <li v-for="other in companions.bad" :key="other.id">
                  <router-link class="plant-chip" :to="'/plants/' + other.id"><PlantIcon :plant-id="other.id" :size="22" />{{ other.name }}</router-link>
                </li>
              </ul>
            </div>
          </section>
        </div>

        <PlantFormDialog v-model:open="formOpen" :plant="plant" />
        <AppDialog v-model:open="deleteOpen" :title="t('plantsView.deleteTitle')">
          <p>{{ t('plantsView.deleteText', { name }) }}</p>
          <template #actions>
            <button type="button" class="btn btn-text" autofocus @click="deleteOpen = false">{{ t('common.cancel') }}</button>
            <button type="button" class="btn btn-danger" @click="confirmDelete">{{ t('common.delete') }}</button>
          </template>
        </AppDialog>
      </template>
    </div>
  `,
};
