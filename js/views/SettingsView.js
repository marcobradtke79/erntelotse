import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { LANGUAGES } from '../i18n/languages.js';
import { settings, setLanguage, setUnits, setTheme } from '../stores/settings.js';
import { gardens, clearAllData } from '../stores/gardens.js';
import { showToast, showError } from '../stores/toast.js';
import { formatArea, formatBytes, formatLength, formatTemperature, formatWeight, UNIT_SYSTEMS } from '../logic/units.js';
import { THEMES } from '../logic/validate.js';
import { exportBackupFile } from '../services/backup.js';
import { ESTIMATED_CAPACITY_BYTES } from '../services/storage.js';
import { storage } from '../services/appStorage.js';
import AppDialog from '../components/AppDialog.js';
import AppIcon from '../components/AppIcon.js';
import ImportButton from '../components/ImportButton.js';
import ClimateSettings from '../components/ClimateSettings.js';

export default {
  name: 'SettingsView',
  components: { AppDialog, AppIcon, ImportButton, ClimateSettings },
  setup() {
    const { t, locale } = useI18n();
    const router = useRouter();

    // Recomputed whenever gardens or settings change
    const usedBytes = computed(() => {
      void gardens.index.map((entry) => entry.updatedAt).join();
      void gardens.active?.updatedAt;
      void JSON.stringify(settings);
      return storage.usage();
    });
    const usagePercent = computed(() => Math.min(100, Math.max(1, (usedBytes.value / ESTIMATED_CAPACITY_BYTES) * 100)));

    const unitExample = (system) => t('settings.units.example', {
      length: formatLength(1.5, system, locale.value),
      area: formatArea(4.8, system, locale.value),
      weight: formatWeight(4.5, system, locale.value),
      temperature: formatTemperature(20, system, locale.value),
    });

    function exportBackup() {
      try {
        exportBackupFile();
        showToast('settings.data.backupExported');
      } catch (error) {
        console.error(error);
        showError('import.errors.invalidStructure');
      }
    }

    const deleteAllOpen = ref(false);

    function confirmDeleteAll() {
      deleteAllOpen.value = false;
      clearAllData();
      showToast('settings.data.deletedAll');
      router.push('/gardens');
    }

    return {
      t, locale, settings, gardens, LANGUAGES, UNIT_SYSTEMS, THEMES,
      setLanguage, setUnits, setTheme, unitExample,
      usedBytes, usagePercent, formatBytes, ESTIMATED_CAPACITY_BYTES,
      exportBackup, deleteAllOpen, confirmDeleteAll,
    };
  },
  template: `
    <div class="page">
      <div class="page-header">
        <h1>{{ t('settings.title') }}</h1>
      </div>

      <div class="settings-list">
        <section class="card" aria-labelledby="settings-language">
          <div class="card-header">
            <AppIcon name="globe" />
            <h2 id="settings-language">{{ t('settings.language.title') }}</h2>
          </div>
          <div class="field">
            <label for="language-select">{{ t('settings.language.label') }}</label>
            <select id="language-select" class="select" :value="settings.language" @change="setLanguage($event.target.value)">
              <option v-for="language in LANGUAGES" :key="language.code" :value="language.code" :lang="language.code">{{ language.name }}</option>
            </select>
          </div>
        </section>

        <section class="card" aria-labelledby="settings-units">
          <div class="card-header">
            <AppIcon name="ruler" />
            <h2 id="settings-units">{{ t('settings.units.title') }}</h2>
          </div>
          <fieldset class="field">
            <legend class="visually-hidden">{{ t('settings.units.title') }}</legend>
            <div class="choice-group">
              <label class="choice" v-for="system in UNIT_SYSTEMS" :key="system">
                <input type="radio" name="units" :value="system" :checked="settings.units === system" @change="setUnits(system)" />
                <span>{{ t('settings.units.' + system) }}</span>
              </label>
            </div>
            <p class="field-hint">{{ unitExample(settings.units) }}</p>
          </fieldset>
        </section>

        <section class="card" aria-labelledby="settings-theme">
          <div class="card-header">
            <AppIcon name="palette" />
            <h2 id="settings-theme">{{ t('settings.theme.title') }}</h2>
          </div>
          <fieldset class="field">
            <legend class="visually-hidden">{{ t('settings.theme.title') }}</legend>
            <div class="choice-group">
              <label class="choice" v-for="theme in THEMES" :key="theme">
                <input type="radio" name="theme" :value="theme" :checked="settings.theme === theme" @change="setTheme(theme)" />
                <span>{{ t('settings.theme.' + theme) }}</span>
              </label>
            </div>
          </fieldset>
        </section>

        <ClimateSettings />

        <section class="card" aria-labelledby="settings-data">
          <div class="card-header">
            <AppIcon name="database" />
            <h2 id="settings-data">{{ t('settings.data.title') }}</h2>
          </div>
          <div class="field">
            <div class="storage-meter" aria-hidden="true"><span :style="{ width: usagePercent + '%' }"></span></div>
            <p>{{ t('settings.data.usage', { used: formatBytes(usedBytes, locale), total: formatBytes(ESTIMATED_CAPACITY_BYTES, locale) }) }}</p>
            <p class="field-hint">{{ t('settings.data.usageHint') }}</p>
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-secondary" :disabled="gardens.index.length === 0" @click="exportBackup">
              <AppIcon name="download" />
              <span>{{ t('settings.data.exportBackup') }}</span>
            </button>
            <ImportButton :label="t('settings.data.importBackup')" />
            <button type="button" class="btn btn-danger-outline" @click="deleteAllOpen = true">
              <AppIcon name="trash" />
              <span>{{ t('settings.data.deleteAll') }}</span>
            </button>
          </div>
        </section>

        <section class="card" aria-labelledby="settings-privacy">
          <div class="card-header">
            <AppIcon name="info" />
            <h2 id="settings-privacy">{{ t('settings.privacy.title') }}</h2>
          </div>
          <p>{{ t('settings.privacy.text') }}</p>
        </section>
      </div>

      <AppDialog v-model:open="deleteAllOpen" :title="t('settings.data.deleteAllTitle')">
        <p>{{ t('settings.data.deleteAllText') }}</p>
        <template #actions>
          <button type="button" class="btn btn-text" autofocus @click="deleteAllOpen = false">{{ t('common.cancel') }}</button>
          <button type="button" class="btn btn-danger" @click="confirmDeleteAll">{{ t('settings.data.deleteAllConfirm') }}</button>
        </template>
      </AppDialog>
    </div>
  `,
};
