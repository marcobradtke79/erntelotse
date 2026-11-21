// Import of a garden file or a full backup, including the replace/copy decisions.

import { ref, shallowReactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { parseImport, readFileText, copyForImport, ImportError } from '../services/exportImport.js';
import { gardens, hasGarden, putGarden, replaceAllData } from '../stores/gardens.js';
import { showError, showToast } from '../stores/toast.js';
import AppDialog from './AppDialog.js';
import AppIcon from './AppIcon.js';

export default {
  name: 'ImportButton',
  components: { AppDialog, AppIcon },
  props: {
    label: { type: String, default: '' },
    variant: { type: String, default: 'btn-secondary' },
  },
  emits: ['imported'],
  setup(props, { emit }) {
    const { t } = useI18n();
    const input = ref(null);
    // shallow: imported documents must stay plain objects (structuredClone fails on proxies)
    const state = shallowReactive({
      queue: [],
      selectSingle: false,
      imported: 0,
      conflict: null,
      backup: null,
    });

    function pick() {
      input.value.click();
    }

    function finish() {
      if (state.imported > 0) {
        showToast('import.success', { params: { count: state.imported } });
        emit('imported');
      }
      state.imported = 0;
      state.queue = [];
    }

    function store(garden) {
      if (putGarden(garden, { select: state.selectSingle })) state.imported++;
    }

    function next() {
      while (state.queue.length > 0) {
        const garden = state.queue.shift();
        if (hasGarden(garden.id)) {
          state.conflict = garden;
          return;
        }
        store(garden);
      }
      finish();
    }

    function resolveConflict(choice) {
      const garden = state.conflict;
      state.conflict = null;
      if (choice === 'replace') store(garden);
      try {
        if (choice === 'copy') store(copyForImport(garden, { name: t('gardens.copyName', { name: garden.name }) }));
      } catch (error) {
        console.error(error);
        showError('errors.saveFailed');
      }
      next();
    }

    function resolveBackup(choice) {
      const backup = state.backup;
      state.backup = null;
      if (choice === 'replace') {
        if (replaceAllData(backup.gardens, backup.settings)) {
          state.imported = backup.gardens.length;
          finish();
        }
      } else if (choice === 'merge') {
        state.queue = [...backup.gardens];
        state.selectSingle = false;
        next();
      }
    }

    async function onChange(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      let result;
      try {
        result = parseImport(await readFileText(file));
      } catch (error) {
        if (error instanceof ImportError) showError(`import.errors.${error.code}`);
        else {
          console.error(error);
          showError('import.errors.invalidStructure');
        }
        return;
      }
      state.imported = 0;
      if (result.kind === 'backup') {
        state.backup = result;
        // Nothing to lose when there are no gardens yet: no need to ask
        if (gardens.index.length === 0) resolveBackup('replace');
        return;
      }
      state.selectSingle = true;
      state.queue = [...result.gardens];
      next();
    }

    return { t, gardens, input, state, pick, onChange, resolveConflict, resolveBackup };
  },
  template: `
    <button type="button" class="btn" :class="variant" @click="pick">
      <AppIcon name="upload" />
      <span>{{ label || t('common.import') }}</span>
    </button>
    <input ref="input" type="file" accept=".json,application/json" class="visually-hidden" tabindex="-1" :aria-label="t('import.fileLabel')" @change="onChange" />

    <AppDialog :open="Boolean(state.conflict)" :title="t('import.conflictTitle')" @close="resolveConflict('skip')">
      <p v-if="state.conflict">{{ t('import.conflictText', { name: state.conflict.name }) }}</p>
      <template #actions>
        <button type="button" class="btn btn-text" @click="resolveConflict('skip')">{{ t('common.cancel') }}</button>
        <button type="button" class="btn btn-secondary" @click="resolveConflict('copy')">{{ t('import.addCopy') }}</button>
        <button type="button" class="btn btn-primary" autofocus @click="resolveConflict('replace')">{{ t('import.replace') }}</button>
      </template>
    </AppDialog>

    <AppDialog :open="Boolean(state.backup) && gardens.index.length > 0" :title="t('import.backupTitle')" @close="resolveBackup('cancel')">
      <p v-if="state.backup">{{ t('import.backupText', { count: state.backup.gardens.length }, state.backup.gardens.length) }}</p>
      <template #actions>
        <button type="button" class="btn btn-text" @click="resolveBackup('cancel')">{{ t('common.cancel') }}</button>
        <button type="button" class="btn btn-danger-outline" @click="resolveBackup('replace')">{{ t('import.replaceAll') }}</button>
        <button type="button" class="btn btn-primary" autofocus @click="resolveBackup('merge')">{{ t('import.merge') }}</button>
      </template>
    </AppDialog>
  `,
};
