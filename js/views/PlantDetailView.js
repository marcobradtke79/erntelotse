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
import { formatLength, formatArea } from '../logic/units.js';
import { proposedPeriod } from '../logic/hints.js';
import { plantUse, plantingStatus, plantingsOfBed, freeArea } from '../logic/plantings.js';
import { measure } from '../logic/elements.js';
import { yearOf } from '../logic/dates.js';
import { periodText } from '../components/bed/plantingText.js';
import { todayIso } from '../logic/dates.js';
import { elementName } from '../components/map/elementText.js';
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

    // --- Use in the garden: grown this year, planned for the time ahead ---
    const today = todayIso();
    const year = yearOf(today);
    const use = computed(() => {
      const garden = gardens.active;
      const own = garden && plant.value ? plantUse(garden, today).get(plant.value.id) : null;
      if (!own) return { used: false, planned: false, rows: [] };
      const bedName = (id) => {
        const bed = garden.elements.find((element) => element.id === id);
        return bed ? elementName(bed, t) : '';
      };
      const row = (planting) => ({
        key: planting.id,
        to: `/map/bed/${planting.bedId}`,
        place: bedName(planting.bedId),
        when: periodText(planting, locale.value, t, year),
        status: plantingStatus(planting, today),
      });
      // a planting can be both begun (pre-cultivation) and still to be planted: list it once
      const seen = new Set();
      const plantings = [...own.current, ...own.planned].filter((planting) => !seen.has(planting.id) && seen.add(planting.id));
      return {
        used: own.usedThisYear,
        planned: own.planned.length > 0,
        rows: [
          ...own.elements.map((element) => ({ key: element.id, to: '/map', place: elementName(element, t), when: element.plantedYear ? String(element.plantedYear) : '', status: 'active' })),
          ...plantings.map(row),
        ],
      };
    });

    // --- Plan a planting of this plant: choose the bed, then draw the area there ---
    const planOpen = ref(false);
    const planBedId = ref(null);
    const proposal = computed(() => (plant.value ? proposedPeriod(plant.value, climate.value, todayIso()) : null));
    /** Beds with their size and what stays free of it during the suggested period */
    const beds = computed(() => {
      const garden = gardens.active;
      if (!garden || !proposal.value) return [];
      const spacingOf = (id) => (catalog.value.has(id) ? catalog.value.get(id).spacing : null);
      const area = (value) => formatArea(value, settings.units, locale.value);
      return garden.elements.filter((element) => element.type === 'bed').map((bed) => {
        const size = measure(bed).area;
        const free = freeArea(size, plantingsOfBed(garden.plantings, bed.id), proposal.value, spacingOf);
        const params = { name: elementName(bed, t), area: area(size), free: area(free) };
        return {
          id: bed.id,
          label: free > 0 ? t('plantsView.plan.bedOption', params) : t('plantsView.plan.bedFull', params),
          note: free > 0 ? t('plantsView.plan.free', params) : t('plantsView.plan.full'),
          full: free <= 0,
        };
      });
    });
    const planBed = computed(() => beds.value.find((bed) => bed.id === planBedId.value) ?? null);
    /** The current season if planting is possible now, else the coming one */
    const suggestion = computed(() => {
      if (!proposal.value) return '';
      const { start, end, preStart } = proposal.value;
      const format = new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
      const date = (iso) => new Date(`${iso}T00:00:00Z`);
      const text = end === null
        ? t('plantsView.plan.suggestionFrom', { date: format.format(date(start)) })
        : t('plantsView.plan.suggestion', { period: format.formatRange(date(start), date(end)) });
      // pre-cultivation is only suggested while there is still time for it
      return preStart && preStart >= todayIso() ? `${text} ${t('plantsView.plan.pre', { date: format.format(date(preStart)) })}` : text;
    });

    function openPlan() {
      // start with the first bed that has room
      if (!beds.value.some((bed) => bed.id === planBedId.value)) planBedId.value = (beds.value.find((bed) => !bed.full) ?? beds.value[0])?.id ?? null;
      planOpen.value = true;
    }

    function startPlan() {
      if (!planBedId.value) return;
      planOpen.value = false;
      router.push({ path: `/map/bed/${planBedId.value}`, query: { plant: plant.value.id } });
    }

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
      resetChanges, confirmDelete, use, year, planOpen, planBedId, planBed, beds, suggestion, openPlan, startPlan,
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
            <p v-if="use.used || use.planned" class="plant-card-use">
              <span v-if="use.used" class="status-chip is-active">{{ t('plantsView.usedYear', { year }) }}</span>
              <span v-if="use.planned" class="status-chip is-planned">{{ t('plantsView.planned') }}</span>
            </p>
          </div>
        </div>

        <div class="btn-row" v-if="gardens.active">
          <button v-if="plant.placement === 'bed'" type="button" class="btn btn-primary" @click="openPlan">
            <AppIcon name="seedling" />
            <span>{{ t('plantsView.plan.button') }}</span>
          </button>
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
          <section v-if="gardens.active" class="card" aria-labelledby="plant-in-garden">
            <div class="card-header">
              <AppIcon name="garden" />
              <h2 id="plant-in-garden">{{ t('plantsView.inGarden') }}</h2>
            </div>
            <p v-if="!use.rows.length" class="muted">{{ t('plantsView.notInGarden') }}</p>
            <ul v-else class="plain-list">
              <li v-for="row in use.rows" :key="row.key">
                <router-link :to="row.to" class="menu-item planting-row">
                  <span class="planting-row-text">
                    <span class="planting-row-name">{{ row.place }}</span>
                    <span v-if="row.when" class="muted small">{{ row.when }}</span>
                  </span>
                  <span class="status-chip" :class="'is-' + row.status">{{ t('status.' + row.status) }}</span>
                </router-link>
              </li>
            </ul>
          </section>

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
        <AppDialog v-model:open="planOpen" :title="t('plantsView.plan.title', { name })">
          <p class="plan-suggestion"><AppIcon name="calendar" /><span>{{ suggestion }}</span></p>
          <template v-if="beds.length">
            <form id="plan-planting-form" class="settings-list" @submit.prevent="startPlan">
              <div class="field">
                <label for="plan-planting-bed">{{ t('plantsView.plan.bed') }}</label>
                <select id="plan-planting-bed" v-model="planBedId" class="select" autofocus>
                  <option v-for="bed in beds" :key="bed.id" :value="bed.id">{{ bed.label }}</option>
                </select>
                <p v-if="planBed" class="field-hint" aria-live="polite">{{ planBed.note }}</p>
              </div>
              <p class="field-hint">{{ t('plantsView.plan.hint') }}</p>
            </form>
          </template>
          <p v-else>{{ t('plantsView.plan.noBeds') }}</p>
          <template #actions>
            <button type="button" class="btn btn-text" @click="planOpen = false">{{ t('common.cancel') }}</button>
            <button v-if="beds.length" type="submit" form="plan-planting-form" class="btn btn-primary">{{ t('plantsView.plan.submit') }}</button>
            <router-link v-else to="/map" class="btn btn-primary">{{ t('plantsView.plan.toMap') }}</router-link>
          </template>
        </AppDialog>
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
