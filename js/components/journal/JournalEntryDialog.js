// New or edited journal entry: date, what was done, plant, place, harvest amount, note.

import { reactive, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { JOURNAL_TYPES, NOTE_MAX_LENGTH, createJournalEntry } from '../../logic/tasks.js';
import { isIsoDate, todayIso } from '../../logic/dates.js';
import { addJournalEntry, updateJournalEntry } from '../../stores/gardens.js';
import { settings } from '../../stores/settings.js';
import { elementName } from '../map/elementText.js';
import AppDialog from '../AppDialog.js';
import LengthInput from '../LengthInput.js';
import PlantSelect from '../PlantSelect.js';

export default {
  name: 'JournalEntryDialog',
  components: { AppDialog, LengthInput, PlantSelect },
  props: {
    open: { type: Boolean, default: false },
    garden: { type: Object, required: true },
    /** null: new entry */
    entry: { type: Object, default: null },
    defaultDate: { type: String, default: null },
  },
  emits: ['update:open'],
  setup(props, { emit }) {
    const { t } = useI18n();
    const draft = reactive({ date: '', type: 'harvest', plantId: null, place: '', amountKg: null, note: '', error: '' });

    const places = computed(() => props.garden.elements
      .filter((element) => ['bed', 'tree', 'shrub', 'greenhouse'].includes(element.type))
      .map((element) => ({ id: element.id, name: elementName(element, t) })));

    watch(() => props.open, (open) => {
      if (!open) return;
      const entry = props.entry;
      Object.assign(draft, {
        date: entry?.date ?? props.defaultDate ?? todayIso(),
        type: entry?.type ?? 'harvest',
        plantId: entry?.plantId ?? null,
        // Entries from tasks point at a planting; show its bed
        place: entry?.sourceKind === 'planting'
          ? props.garden.plantings.find((planting) => planting.id === entry.sourceId)?.bedId ?? ''
          : entry?.sourceId ?? '',
        amountKg: entry?.amountKg ?? null,
        note: entry?.note ?? '',
        error: '',
      });
    });

    function save() {
      if (!isIsoDate(draft.date)) {
        draft.error = t('planting.errors.date');
        return;
      }
      const fields = {
        date: draft.date,
        type: draft.type,
        plantId: draft.plantId,
        amountKg: draft.type === 'harvest' ? draft.amountKg : null,
        note: draft.note.slice(0, NOTE_MAX_LENGTH),
      };
      if (props.entry) {
        // Keep the link to a planting unless the place was changed by hand
        const keepSource = props.entry.sourceKind === 'planting' &&
          props.garden.plantings.find((planting) => planting.id === props.entry.sourceId)?.bedId === draft.place;
        if (!keepSource) Object.assign(fields, { sourceId: draft.place || null, sourceKind: draft.place ? 'element' : null });
        updateJournalEntry(props.entry.id, fields);
      } else {
        addJournalEntry(createJournalEntry({ ...fields, sourceId: draft.place || null, sourceKind: draft.place ? 'element' : null }));
      }
      emit('update:open', false);
    }

    return { t, settings, draft, places, JOURNAL_TYPES, NOTE_MAX_LENGTH, save };
  },
  template: `
    <AppDialog :open="open" :title="entry ? t('journal.editTitle') : t('journal.newTitle')" @update:open="$emit('update:open', $event)">
      <form id="journal-form" class="settings-list" novalidate @submit.prevent="save">
        <div class="size-grid">
          <div class="field">
            <label for="journal-date">{{ t('journal.date') }}</label>
            <input id="journal-date" v-model="draft.date" class="input" type="date" required autofocus />
          </div>
          <div class="field">
            <label for="journal-type">{{ t('journal.type') }}</label>
            <select id="journal-type" v-model="draft.type" class="select">
              <option v-for="type in JOURNAL_TYPES" :key="type" :value="type">{{ t('journal.types.' + type) }}</option>
            </select>
          </div>
        </div>
        <PlantSelect v-model="draft.plantId" placement="all" :label="t('planting.plant')" allow-none />
        <div class="field">
          <label for="journal-place">{{ t('journal.place') }}</label>
          <select id="journal-place" v-model="draft.place" class="select">
            <option value="">{{ t('journal.noPlace') }}</option>
            <option v-for="place in places" :key="place.id" :value="place.id">{{ place.name }}</option>
          </select>
        </div>
        <LengthInput v-if="draft.type === 'harvest'" v-model="draft.amountKg" :label="t('journal.amount')" :units="settings.units" quantity="weight" :min="0" optional />
        <div class="field">
          <label for="journal-note">{{ t('planting.note') }}</label>
          <textarea id="journal-note" v-model="draft.note" class="input textarea" rows="3" :maxlength="NOTE_MAX_LENGTH"></textarea>
        </div>
        <p v-if="draft.error" class="field-error">{{ draft.error }}</p>
      </form>
      <template #actions>
        <button type="button" class="btn btn-text" @click="$emit('update:open', false)">{{ t('common.cancel') }}</button>
        <button type="submit" form="journal-form" class="btn btn-primary">{{ t('common.save') }}</button>
      </template>
    </AppDialog>
  `,
};
