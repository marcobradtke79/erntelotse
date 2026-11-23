import { ref, reactive, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  gardens, createGarden, renameGarden, duplicateGardenById, deleteGarden,
  putGarden, selectGarden,
} from '../stores/gardens.js';
import { settings } from '../stores/settings.js';
import { showToast, showError } from '../stores/toast.js';
import { checkGardenName, GARDEN_NAME_MAX_LENGTH } from '../logic/gardenModel.js';
import { exportGardenFile } from '../services/backup.js';
import AppDialog from '../components/AppDialog.js';
import AppIcon from '../components/AppIcon.js';
import EmptyState from '../components/EmptyState.js';
import ImportButton from '../components/ImportButton.js';

export default {
  name: 'GardensView',
  components: { AppDialog, AppIcon, EmptyState, ImportButton },
  setup() {
    const { t, locale } = useI18n();
    const router = useRouter();

    const sorted = computed(() => [...gardens.index].sort((a, b) => a.name.localeCompare(b.name, locale.value)));

    const dateFormat = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }));
    const formatDate = (iso) => (iso ? dateFormat.value.format(new Date(iso)) : '');

    // Name dialog: create | rename | duplicate
    const nameDialog = reactive({ open: false, mode: 'create', id: null, name: '', error: null });
    const nameInput = ref(null);

    const nameDialogTitle = computed(() => t(`gardens.${nameDialog.mode}Title`));
    const nameError = computed(() => {
      if (nameDialog.error === 'required') return t('common.required');
      if (nameDialog.error === 'tooLong') return t('common.tooLong', { max: GARDEN_NAME_MAX_LENGTH });
      return '';
    });

    function openNameDialog(mode, entry = null) {
      nameDialog.mode = mode;
      nameDialog.id = entry?.id ?? null;
      nameDialog.name = mode === 'rename' ? entry.name
        : mode === 'duplicate' ? t('gardens.copyName', { name: entry.name }).slice(0, GARDEN_NAME_MAX_LENGTH)
          : '';
      nameDialog.error = null;
      nameDialog.open = true;
    }

    function submitName() {
      nameDialog.error = checkGardenName(nameDialog.name);
      if (nameDialog.error) {
        nameInput.value?.focus();
        return;
      }
      const name = nameDialog.name.trim();
      if (nameDialog.mode === 'create') {
        const garden = createGarden(name);
        if (!garden) return;
        showToast('gardens.created', { params: { name } });
        nameDialog.open = false;
        // First step for a new garden: its outline on the map (guided setup)
        router.push({ path: '/map', query: { setup: '1' } });
        return;
      }
      if (nameDialog.mode === 'rename') {
        if (!renameGarden(nameDialog.id, name)) return;
        showToast('gardens.renamed');
      } else {
        if (!duplicateGardenById(nameDialog.id, name)) return;
        showToast('gardens.duplicated', { params: { name } });
      }
      nameDialog.open = false;
    }

    // Delete
    const deleteDialog = reactive({ open: false, entry: null });

    function askDelete(entry) {
      deleteDialog.entry = entry;
      deleteDialog.open = true;
    }

    function confirmDelete() {
      const entry = deleteDialog.entry;
      const wasActive = entry.id === settings.activeGardenId;
      deleteDialog.open = false;
      const snapshot = deleteGarden(entry.id);
      showToast('gardens.deleted', {
        params: { name: entry.name },
        action: snapshot ? { key: 'common.undo', handler: () => putGarden(snapshot, { select: wasActive }) } : null,
      });
    }

    function open(entry) {
      selectGarden(entry.id);
      router.push('/dashboard');
    }

    function exportGarden(entry) {
      try {
        exportGardenFile(entry.id);
        showToast('gardens.exported');
      } catch {
        showError('gardens.loadError', { name: entry.name });
      }
    }

    return {
      t, gardens, settings, sorted, formatDate,
      nameDialog, nameInput, nameDialogTitle, nameError, openNameDialog, submitName,
      deleteDialog, askDelete, confirmDelete, open, exportGarden, GARDEN_NAME_MAX_LENGTH,
    };
  },
  template: `
    <div class="page">
      <div class="page-header">
        <h1>{{ t('gardens.title') }}</h1>
        <div class="btn-row" v-if="gardens.index.length > 0">
          <ImportButton />
          <button type="button" class="btn btn-primary" @click="openNameDialog('create')">
            <AppIcon name="plus" />
            <span>{{ t('gardens.new') }}</span>
          </button>
        </div>
      </div>

      <EmptyState v-if="gardens.index.length === 0" :title="t('gardens.emptyTitle')" :text="t('gardens.emptyText')">
        <div class="btn-row">
          <button type="button" class="btn btn-primary" @click="openNameDialog('create')">
            <AppIcon name="plus" />
            <span>{{ t('gardens.emptyAction') }}</span>
          </button>
          <ImportButton />
        </div>
      </EmptyState>

      <ul v-else class="card-grid plain-list" role="list">
        <li v-for="entry in sorted" :key="entry.id" class="card garden-card" :class="{ 'is-active': entry.id === settings.activeGardenId }">
          <div class="garden-card-title">
            <h2>{{ entry.name }}</h2>
            <span v-if="entry.id === settings.activeGardenId" class="badge">
              <AppIcon name="check" />{{ t('common.active') }}
            </span>
            <span v-if="gardens.loadErrors[entry.id]" class="badge">
              <AppIcon name="alert" />{{ t('gardens.damaged') }}
            </span>
          </div>
          <p class="muted small" v-if="entry.updatedAt">{{ t('gardens.updated', { date: formatDate(entry.updatedAt) }) }}</p>
          <div class="btn-row" role="group" :aria-label="t('gardens.actionsFor', { name: entry.name })">
            <button type="button" class="btn btn-primary" @click="open(entry)">{{ t('common.open') }}</button>
            <button type="button" class="btn btn-icon" :title="t('common.rename')" @click="openNameDialog('rename', entry)">
              <AppIcon name="edit" :label="t('common.rename')" />
            </button>
            <button type="button" class="btn btn-icon" :title="t('common.duplicate')" @click="openNameDialog('duplicate', entry)">
              <AppIcon name="copy" :label="t('common.duplicate')" />
            </button>
            <button type="button" class="btn btn-icon" :title="t('common.export')" @click="exportGarden(entry)">
              <AppIcon name="download" :label="t('common.export')" />
            </button>
            <button type="button" class="btn btn-icon" :title="t('common.delete')" @click="askDelete(entry)">
              <AppIcon name="trash" :label="t('common.delete')" />
            </button>
          </div>
        </li>
      </ul>

      <AppDialog v-model:open="nameDialog.open" :title="nameDialogTitle">
        <form class="field" novalidate @submit.prevent="submitName" id="garden-name-form">
          <label for="garden-name">{{ t('common.name') }}</label>
          <input
            id="garden-name"
            ref="nameInput"
            v-model="nameDialog.name"
            class="input"
            type="text"
            autocomplete="off"
            autofocus
            required
            :maxlength="GARDEN_NAME_MAX_LENGTH + 20"
            :placeholder="t('gardens.namePlaceholder')"
            :aria-invalid="nameError ? 'true' : 'false'"
            :aria-describedby="nameError ? 'garden-name-error' : null"
          />
          <p v-if="nameError" id="garden-name-error" class="field-error">{{ nameError }}</p>
        </form>
        <template #actions>
          <button type="button" class="btn btn-text" @click="nameDialog.open = false">{{ t('common.cancel') }}</button>
          <button type="submit" form="garden-name-form" class="btn btn-primary">
            {{ nameDialog.mode === 'create' ? t('common.create') : nameDialog.mode === 'rename' ? t('common.save') : t('common.duplicate') }}
          </button>
        </template>
      </AppDialog>

      <AppDialog v-model:open="deleteDialog.open" :title="t('gardens.deleteTitle')">
        <p v-if="deleteDialog.entry">{{ t('gardens.deleteText', { name: deleteDialog.entry.name }) }}</p>
        <p class="muted">{{ t('gardens.deleteHint') }}</p>
        <template #actions>
          <button type="button" class="btn btn-text" autofocus @click="deleteDialog.open = false">{{ t('common.cancel') }}</button>
          <button type="button" class="btn btn-danger" @click="confirmDelete">{{ t('common.delete') }}</button>
        </template>
      </AppDialog>
    </div>
  `,
};
