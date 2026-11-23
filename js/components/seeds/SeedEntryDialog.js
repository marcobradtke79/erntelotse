// Adds or edits an entry of the seed stock: plant, variety, number of seeds, use-by year, note.

import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { VARIETY_MAX_LENGTH, SEED_NOTE_MAX_LENGTH, MAX_SEEDS } from '../../logic/seeds.js';
import AppDialog from '../AppDialog.js';
import PlantSelect from '../PlantSelect.js';

export default {
  name: 'SeedEntryDialog',
  components: { AppDialog, PlantSelect },
  props: {
    open: { type: Boolean, default: false },
    /** Entry to edit, or null for a new one */
    entry: { type: Object, default: null },
    /** Values for a new entry: { plantId, seeds } */
    preset: { type: Object, default: null },
  },
  emits: ['update:open', 'save'],
  setup(props, { emit }) {
    const { t } = useI18n();
    const plantId = ref('carrot');
    const variety = ref('');
    const seeds = ref('');
    const useBy = ref('');
    const note = ref('');
    const error = ref('');

    watch(() => props.open, (open) => {
      if (!open) return;
      const source = props.entry ?? props.preset ?? {};
      plantId.value = source.plantId ?? plantId.value;
      variety.value = source.variety ?? '';
      seeds.value = source.seeds ?? '';
      useBy.value = source.useBy ?? '';
      note.value = source.note ?? '';
      error.value = '';
    }, { immediate: true });

    function submit() {
      const count = Number(seeds.value);
      if (seeds.value === '' || !Number.isInteger(count) || count < 0 || count > MAX_SEEDS) {
        error.value = t('seeds.form.errorSeeds');
        return;
      }
      const year = useBy.value === '' || useBy.value === null ? null : Number(useBy.value);
      if (year !== null && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
        error.value = t('seeds.form.errorUseBy');
        return;
      }
      emit('save', { plantId: plantId.value, variety: variety.value.trim(), seeds: count, useBy: year, note: note.value });
      emit('update:open', false);
    }

    return { t, plantId, variety, seeds, useBy, note, error, submit, VARIETY_MAX_LENGTH, SEED_NOTE_MAX_LENGTH, MAX_SEEDS };
  },
  template: `
    <AppDialog :open="open" :title="entry ? t('seeds.form.titleEdit') : t('seeds.form.titleNew')" @update:open="$emit('update:open', $event)">
      <form id="seed-entry-form" class="settings-list" novalidate @submit.prevent="submit">
        <PlantSelect v-model="plantId" placement="bed" :label="t('planting.plant')" />
        <div class="field">
          <label for="seed-variety">{{ t('seeds.form.variety') }}</label>
          <input id="seed-variety" v-model="variety" class="input" type="text" :maxlength="VARIETY_MAX_LENGTH" autocomplete="off" :placeholder="t('seeds.form.varietyPlaceholder')" />
        </div>
        <div class="size-grid">
          <div class="field">
            <label for="seed-count">{{ t('seeds.form.seeds') }}</label>
            <input id="seed-count" v-model="seeds" class="input" type="number" inputmode="numeric" min="0" :max="MAX_SEEDS" step="1" required autofocus />
          </div>
          <div class="field">
            <label for="seed-use-by">{{ t('seeds.form.useBy') }}</label>
            <input id="seed-use-by" v-model="useBy" class="input" type="number" inputmode="numeric" min="2000" max="2100" step="1" />
          </div>
        </div>
        <p class="field-hint">{{ t('seeds.form.seedsHint') }}</p>
        <p v-if="error" class="field-error" role="alert">{{ error }}</p>
        <div class="field">
          <label for="seed-note">{{ t('seeds.form.note') }}</label>
          <textarea id="seed-note" v-model="note" class="input textarea" rows="2" :maxlength="SEED_NOTE_MAX_LENGTH"></textarea>
        </div>
      </form>
      <template #actions>
        <button type="button" class="btn btn-text" @click="$emit('update:open', false)">{{ t('common.cancel') }}</button>
        <button type="submit" form="seed-entry-form" class="btn btn-primary">{{ t('common.save') }}</button>
      </template>
    </AppDialog>
  `,
};
