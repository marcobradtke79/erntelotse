// Journal (docs/concept.md §2): what was done – from ticked-off tasks and own entries –
// with harvest totals per plant for the year shown in the header.

import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { gardens, deleteJournalEntry, restoreJournalEntry } from '../stores/gardens.js';
import { settings } from '../stores/settings.js';
import { period, currentYear } from '../stores/period.js';
import { plantNameById } from '../stores/catalog.js';
import { showToast } from '../stores/toast.js';
import { JOURNAL_TYPES, filterJournal, harvestTotals } from '../logic/tasks.js';
import { formatWeight } from '../logic/units.js';
import { todayIso, toIsoDate } from '../logic/dates.js';
import AppIcon from '../components/AppIcon.js';
import EmptyState from '../components/EmptyState.js';
import PlantIcon from '../components/PlantIcon.js';
import JournalEntryDialog from '../components/journal/JournalEntryDialog.js';
import { TASK_ICONS } from '../components/tasks/taskText.js';
import { elementName } from '../components/map/elementText.js';

const JOURNAL_ICONS = { ...TASK_ICONS, note: 'book' };

export default {
  name: 'JournalView',
  components: { AppIcon, EmptyState, PlantIcon, JournalEntryDialog },
  setup() {
    const { t, locale } = useI18n();
    const garden = computed(() => gardens.active);
    const type = ref('');
    const plantId = ref('');
    const place = ref('');
    const dialogOpen = ref(false);
    const editing = ref(null);

    const bedOf = (entry) => (entry.sourceKind === 'planting'
      ? garden.value.plantings.find((planting) => planting.id === entry.sourceId)?.bedId ?? null
      : null);

    const placeName = (entry) => {
      const id = entry.sourceKind === 'planting' ? bedOf(entry) : entry.sourceId;
      const element = id ? garden.value.elements.find((item) => item.id === id) : null;
      return element ? elementName(element, t) : '';
    };

    const yearEntries = computed(() => (garden.value ? filterJournal(garden.value.journal, { year: period.year }) : []));
    const entries = computed(() => (garden.value
      ? filterJournal(garden.value.journal, { year: period.year, type: type.value || null, plantId: plantId.value || null, sourceId: place.value || null, bedOf })
      : []));

    // Filter choices from what this year's journal contains
    const plantChoices = computed(() => [...new Set(yearEntries.value.map((entry) => entry.plantId).filter(Boolean))]
      .map((id) => ({ id, name: plantNameById(id, t) }))
      .sort((a, b) => a.name.localeCompare(b.name, locale.value)));
    const placeChoices = computed(() => {
      const ids = new Set(yearEntries.value.map((entry) => (entry.sourceKind === 'planting' ? bedOf(entry) : entry.sourceId)).filter(Boolean));
      return garden.value.elements.filter((element) => ids.has(element.id)).map((element) => ({ id: element.id, name: elementName(element, t) }));
    });

    const months = computed(() => {
      const format = new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric', timeZone: 'UTC' });
      const groups = new Map();
      for (const entry of entries.value) {
        const key = entry.date.slice(0, 7);
        if (!groups.has(key)) groups.set(key, { key, title: format.format(new Date(`${key}-01T00:00:00Z`)), entries: [] });
        groups.get(key).entries.push(entry);
      }
      return [...groups.values()];
    });

    const totals = computed(() => (garden.value ? harvestTotals(garden.value.journal, period.year) : []));
    const dayFormat = computed(() => new Intl.DateTimeFormat(locale.value, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }));

    function openNew() {
      editing.value = null;
      dialogOpen.value = true;
    }

    function edit(entry) {
      editing.value = entry;
      dialogOpen.value = true;
    }

    function remove(entry) {
      const copy = deleteJournalEntry(entry.id);
      showToast('journal.deleted', { action: { key: 'common.undo', handler: () => restoreJournalEntry(copy, todayIso()) } });
    }

    return {
      t, garden, settings, period, type, plantId, place, entries, yearEntries, months, totals, plantChoices, placeChoices,
      dialogOpen, editing, JOURNAL_TYPES, JOURNAL_ICONS, openNew, edit, remove, placeName,
      plantName: (id) => plantNameById(id, t),
      weight: (kg) => formatWeight(kg, settings.units, locale.value),
      day: (iso) => dayFormat.value.format(new Date(`${iso}T00:00:00Z`)),
      defaultDate: computed(() => (period.year === currentYear() ? todayIso() : toIsoDate(period.year, 6, 1))),
    };
  },
  template: `
    <div class="page">
      <div class="page-header">
        <h1>{{ t('journal.title', { year: period.year }) }}</h1>
        <button v-if="garden" type="button" class="btn btn-primary" @click="openNew">
          <AppIcon name="plus" />
          <span>{{ t('journal.new') }}</span>
        </button>
      </div>

      <EmptyState v-if="!garden" :title="t('placeholder.noGardenTitle')" :text="t('placeholder.noGardenText')">
        <router-link to="/gardens" class="btn btn-primary">
          <AppIcon name="garden" />
          <span>{{ t('placeholder.toGardens') }}</span>
        </router-link>
      </EmptyState>

      <template v-else>
        <EmptyState v-if="!yearEntries.length" :title="t('journal.emptyTitle')" :text="t('journal.emptyText')" />

        <div v-else class="journal-layout">
          <section class="card" aria-labelledby="journal-entries">
            <h2 id="journal-entries" class="visually-hidden">{{ t('journal.entries') }}</h2>
            <div class="journal-filters">
              <div class="field">
                <label for="journal-filter-type">{{ t('journal.type') }}</label>
                <select id="journal-filter-type" v-model="type" class="select">
                  <option value="">{{ t('journal.all') }}</option>
                  <option v-for="item in JOURNAL_TYPES" :key="item" :value="item">{{ t('journal.types.' + item) }}</option>
                </select>
              </div>
              <div class="field">
                <label for="journal-filter-plant">{{ t('planting.plant') }}</label>
                <select id="journal-filter-plant" v-model="plantId" class="select">
                  <option value="">{{ t('journal.all') }}</option>
                  <option v-for="item in plantChoices" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </div>
              <div class="field">
                <label for="journal-filter-place">{{ t('journal.place') }}</label>
                <select id="journal-filter-place" v-model="place" class="select">
                  <option value="">{{ t('journal.all') }}</option>
                  <option v-for="item in placeChoices" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </div>
            </div>

            <p v-if="!entries.length" class="muted">{{ t('journal.noMatch') }}</p>
            <div v-for="month in months" :key="month.key" class="journal-month">
              <h3>{{ month.title }}</h3>
              <ul class="plain-list hint-list">
                <li v-for="entry in month.entries" :key="entry.id" class="hint-item journal-entry" :class="'task-' + (entry.type === 'note' ? 'care' : entry.type)">
                  <span class="task-icon"><AppIcon :name="JOURNAL_ICONS[entry.type]" :label="t('journal.types.' + entry.type)" /></span>
                  <div class="hint-item-body">
                    <p class="hint-item-title">
                      <strong>{{ t('journal.types.' + entry.type) }}</strong>
                      <span v-if="entry.plantId" class="hint-item-plant"><PlantIcon :plant-id="entry.plantId" :size="20" />{{ plantName(entry.plantId) }}</span>
                      <strong v-if="entry.amountKg !== null && entry.amountKg !== undefined" class="journal-amount">{{ weight(entry.amountKg) }}</strong>
                    </p>
                    <p v-if="entry.note" class="small">{{ entry.note }}</p>
                    <p class="small muted">{{ day(entry.date) }}<span v-if="placeName(entry)"> · {{ placeName(entry) }}</span></p>
                  </div>
                  <div class="hint-actions">
                    <button type="button" class="btn btn-icon" :title="t('journal.edit')" @click="edit(entry)">
                      <AppIcon name="edit" :label="t('journal.edit')" />
                    </button>
                    <button type="button" class="btn btn-icon" :title="t('common.delete')" @click="remove(entry)">
                      <AppIcon name="trash" :label="t('common.delete')" />
                    </button>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          <section class="card" aria-labelledby="journal-harvest">
            <div class="card-header">
              <AppIcon name="basket" />
              <h2 id="journal-harvest">{{ t('journal.harvestTitle', { year: period.year }) }}</h2>
            </div>
            <p v-if="!totals.length" class="muted small">{{ t('journal.noHarvest') }}</p>
            <ul v-else class="plain-list harvest-totals">
              <li v-for="total in totals" :key="total.plantId">
                <PlantIcon :plant-id="total.plantId" :size="24" />
                <span class="harvest-name">{{ plantName(total.plantId) }}</span>
                <strong>{{ weight(total.kg) }}</strong>
                <span class="small muted">{{ t('journal.harvests', { count: total.entries }, total.entries) }}</span>
              </li>
            </ul>
          </section>
        </div>
      </template>

      <JournalEntryDialog v-if="garden" v-model:open="dialogOpen" :garden="garden" :entry="editing" :default-date="defaultDate" />
    </div>
  `,
};
