// Seed stock (docs/concept.md §2): what the plan still needs against what is in stock –
// a shopping list for seeds and young plants – and the stock itself.

import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { gardens, addSeedEntry, updateSeedEntry, deleteSeedEntry } from '../stores/gardens.js';
import { catalog, plantNameById } from '../stores/catalog.js';
import { showToast, showError } from '../stores/toast.js';
import { settings } from '../stores/settings.js';
import { formatArea } from '../logic/units.js';
import { shoppingList, stockByPlant, createSeedEntry } from '../logic/seeds.js';
import { todayIso, yearOf } from '../logic/dates.js';
import AppIcon from '../components/AppIcon.js';
import PlantIcon from '../components/PlantIcon.js';
import EmptyState from '../components/EmptyState.js';
import SeedEntryDialog from '../components/seeds/SeedEntryDialog.js';

export default {
  name: 'SeedsView',
  components: { AppIcon, PlantIcon, EmptyState, SeedEntryDialog },
  setup() {
    const { t, locale } = useI18n();
    const garden = computed(() => gardens.active);
    const today = todayIso();
    const thisYear = yearOf(today);
    const dialogOpen = ref(false);
    const editing = ref(null);
    const preset = ref(null);

    const number = (value) => new Intl.NumberFormat(locale.value).format(value);
    const dateFormat = computed(() => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }));
    const date = (iso) => dateFormat.value.format(new Date(`${iso}T00:00:00Z`));
    const name = (plantId) => plantNameById(plantId, t);
    const area = (squareMetres) => formatArea(squareMetres, settings.units, locale.value);

    const list = computed(() => (garden.value ? shoppingList(garden.value, catalog.value, today) : { seeds: [], youngPlants: [] }));
    const toBuy = computed(() => list.value.seeds.filter((item) => item.missing > 0));
    const planned = computed(() => list.value.seeds.length + list.value.youngPlants.length > 0);

    const stock = computed(() => {
      if (!garden.value) return [];
      const needs = new Map(list.value.seeds.map((item) => [item.plantId, item.need]));
      return [...stockByPlant(garden.value.seedStock)].map(([plantId, group]) => ({
        plantId,
        name: name(plantId),
        total: group.total,
        planned: Math.min(needs.get(plantId) ?? 0, group.total),
        entries: group.entries.map((entry) => ({ entry, expired: entry.useBy !== null && entry.useBy < thisYear })),
      })).sort((a, b) => a.name.localeCompare(b.name, locale.value));
    });

    function openNew(values = null) {
      editing.value = null;
      preset.value = values;
      dialogOpen.value = true;
    }

    function edit(entry) {
      editing.value = entry;
      preset.value = null;
      dialogOpen.value = true;
    }

    function save(fields) {
      if (editing.value) updateSeedEntry(editing.value.id, fields);
      else addSeedEntry(createSeedEntry(fields));
    }

    function remove(entry) {
      const copy = deleteSeedEntry(entry.id);
      if (copy) showToast('seeds.deleted', { action: { key: 'common.undo', handler: () => addSeedEntry(copy) } });
    }

    async function copyList() {
      const lines = [
        ...toBuy.value.map((item) => (item.missingArea !== null
          ? t('seeds.listSeedsArea', { plant: name(item.plantId), area: area(item.missingArea) })
          : t('seeds.listSeeds', { plant: name(item.plantId), count: number(item.missing) }))),
        ...list.value.youngPlants.map((item) => t('seeds.listPlants', { plant: name(item.plantId), count: number(item.count) })),
      ];
      try {
        await navigator.clipboard.writeText(lines.join('\n'));
        showToast('seeds.copied');
      } catch {
        showError('seeds.copyFailed');
      }
    }

    return { t, garden, list, toBuy, planned, stock, dialogOpen, editing, preset, number, date, name, area, openNew, edit, save, remove, copyList };
  },
  template: `
    <div class="page">
      <div class="page-header">
        <h1>{{ t('seeds.title') }}</h1>
        <button v-if="garden" type="button" class="btn btn-primary" @click="openNew()">
          <AppIcon name="plus" />
          <span>{{ t('seeds.add') }}</span>
        </button>
      </div>

      <EmptyState v-if="!garden" :title="t('placeholder.noGardenTitle')" :text="t('placeholder.noGardenText')">
        <router-link to="/gardens" class="btn btn-primary">
          <AppIcon name="garden" />
          <span>{{ t('placeholder.toGardens') }}</span>
        </router-link>
      </EmptyState>

      <div v-else class="seeds-layout">
        <section class="card" aria-labelledby="seeds-to-buy">
          <div class="card-header">
            <AppIcon name="bag" />
            <h2 id="seeds-to-buy">{{ t('seeds.toBuy') }}</h2>
            <button v-if="toBuy.length || list.youngPlants.length" type="button" class="btn btn-text seeds-copy" @click="copyList">
              <AppIcon name="copy" /><span>{{ t('seeds.copy') }}</span>
            </button>
          </div>
          <p v-if="!planned" class="muted">{{ t('seeds.nothingPlanned') }}</p>
          <template v-else>
            <p class="small muted">{{ t('seeds.needHint') }} {{ t('seeds.areaHint') }}</p>
            <p v-if="!toBuy.length" class="seeds-covered"><AppIcon name="check" /><span>{{ t('seeds.covered') }}</span></p>
            <ul v-else class="plain-list seeds-list">
              <li v-for="item in toBuy" :key="item.plantId" class="seed-row">
                <PlantIcon :plant-id="item.plantId" :size="32" />
                <div class="seed-row-text">
                  <router-link class="seed-row-name" :to="'/plants/' + item.plantId">{{ name(item.plantId) }}</router-link>
                  <template v-if="item.missingArea !== null">
                    <span><strong>{{ t('seeds.missingArea', { area: area(item.missingArea) }) }}</strong></span>
                    <span class="small muted">{{ t('seeds.rowArea', { area: area(item.area), have: number(item.have) }) }} · {{ t('seeds.from', { date: date(item.firstOn) }) }}</span>
                  </template>
                  <template v-else>
                    <span><strong>{{ t('seeds.missing', { count: number(item.missing) }) }}</strong></span>
                    <span class="small muted">{{ t('seeds.row', { need: number(item.need), have: number(item.have) }) }} · {{ t('seeds.from', { date: date(item.firstOn) }) }}</span>
                  </template>
                  <span v-if="item.expired" class="small seed-warning"><AppIcon name="alert" />{{ t('seeds.expiredNote') }}</span>
                </div>
                <button type="button" class="btn btn-secondary" @click="openNew({ plantId: item.plantId, seeds: item.missing })">{{ t('seeds.bought') }}</button>
              </li>
            </ul>

            <template v-if="list.youngPlants.length">
              <h3>{{ t('seeds.youngTitle') }}</h3>
              <p class="small muted">{{ t('seeds.youngHint') }}</p>
              <ul class="plain-list seeds-list">
                <li v-for="item in list.youngPlants" :key="item.plantId" class="seed-row">
                  <PlantIcon :plant-id="item.plantId" :size="32" />
                  <div class="seed-row-text">
                    <router-link class="seed-row-name" :to="'/plants/' + item.plantId">{{ name(item.plantId) }}</router-link>
                    <span class="small muted">{{ t('seeds.plants', { count: number(item.count) }, item.count) }} · {{ t('seeds.from', { date: date(item.firstOn) }) }}</span>
                  </div>
                </li>
              </ul>
            </template>
          </template>
        </section>

        <section class="card" aria-labelledby="seeds-in-stock">
          <div class="card-header">
            <AppIcon name="seed" />
            <h2 id="seeds-in-stock">{{ t('seeds.inStock') }}</h2>
          </div>
          <p v-if="!stock.length" class="muted">{{ t('seeds.stockEmpty') }}</p>
          <ul v-else class="plain-list seeds-list">
            <li v-for="group in stock" :key="group.plantId" class="seed-group">
              <div class="seed-row">
                <PlantIcon :plant-id="group.plantId" :size="32" />
                <div class="seed-row-text">
                  <router-link class="seed-row-name" :to="'/plants/' + group.plantId">{{ group.name }}</router-link>
                  <span class="small muted">{{ t('seeds.total', { count: number(group.total) }, group.total) }}<template v-if="group.planned"> · {{ t('seeds.planned', { planned: number(group.planned), total: number(group.total) }) }}</template></span>
                </div>
              </div>
              <ul class="plain-list seed-entries">
                <li v-for="item in group.entries" :key="item.entry.id" class="seed-entry">
                  <div class="seed-row-text">
                    <span><strong>{{ item.entry.variety || t('seeds.noVariety') }}</strong> · {{ t('seeds.total', { count: number(item.entry.seeds) }, item.entry.seeds) }}</span>
                    <span v-if="item.entry.useBy" class="small" :class="item.expired ? 'seed-warning' : 'muted'">
                      <AppIcon v-if="item.expired" name="alert" />{{ t('seeds.useBy', { year: item.entry.useBy }) }}<template v-if="item.expired"> – {{ t('seeds.expired') }}</template>
                    </span>
                    <span v-if="item.entry.note" class="small muted">{{ item.entry.note }}</span>
                  </div>
                  <button type="button" class="btn btn-icon" :title="t('seeds.form.titleEdit')" @click="edit(item.entry)">
                    <AppIcon name="edit" :label="t('seeds.form.titleEdit')" />
                  </button>
                  <button type="button" class="btn btn-icon" :title="t('common.delete')" @click="remove(item.entry)">
                    <AppIcon name="trash" :label="t('common.delete')" />
                  </button>
                </li>
              </ul>
            </li>
          </ul>
        </section>
      </div>

      <SeedEntryDialog v-model:open="dialogOpen" :entry="editing" :preset="preset" @save="save" />
    </div>
  `,
};
