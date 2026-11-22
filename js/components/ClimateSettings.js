// Climate of the active garden (docs/concept.md §6.2): hemisphere and how much
// earlier or later spring starts than in Central Europe.

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { gardens, setClimate } from '../stores/gardens.js';
import { PRESETS, presetOf, shiftFromLastFrost, lastFrostForShift } from '../logic/climate.js';
import AppIcon from './AppIcon.js';

export default {
  name: 'ClimateSettings',
  components: { AppIcon },
  setup() {
    const { t, locale } = useI18n();
    const garden = computed(() => gardens.active);
    const preset = ref('average');
    const lastFrost = ref('2025-05-15');

    watch(() => garden.value?.climate, (climate) => {
      if (!climate) return;
      preset.value = presetOf(climate.shiftWeeks);
      lastFrost.value = `2025-${lastFrostForShift(climate.shiftWeeks)}`;
    }, { immediate: true, deep: true });

    function update(changes) {
      setClimate({ ...garden.value.climate, ...changes });
    }

    function choosePreset(value) {
      preset.value = value;
      if (value !== 'custom') update({ shiftWeeks: PRESETS[value] });
    }

    function setLastFrost(event) {
      const value = event.target.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
      update({ shiftWeeks: shiftFromLastFrost(value.slice(5)) });
    }

    const frostText = computed(() => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', timeZone: 'UTC' })
      .format(new Date(`2025-${lastFrostForShift(garden.value?.climate.shiftWeeks ?? 0)}T00:00:00Z`)));
    const shiftText = computed(() => {
      const shift = garden.value?.climate.shiftWeeks ?? 0;
      if (shift === 0) return t('climate.noShift');
      return t(shift > 0 ? 'climate.later' : 'climate.earlier', { count: Math.abs(shift) }, Math.abs(shift));
    });

    return { t, garden, preset, lastFrost, PRESETS, update, choosePreset, setLastFrost, frostText, shiftText };
  },
  template: `
    <section v-if="garden" class="card" aria-labelledby="settings-climate">
      <div class="card-header">
        <AppIcon name="dashboard" />
        <h2 id="settings-climate">{{ t('climate.title', { garden: garden.name }) }}</h2>
      </div>
      <fieldset class="field">
        <legend>{{ t('climate.hemisphere') }}</legend>
        <div class="choice-group">
          <label class="choice">
            <input type="radio" name="hemisphere" value="north" :checked="garden.climate.hemisphere === 'north'" @change="update({ hemisphere: 'north' })" />
            <span>{{ t('climate.north') }}</span>
          </label>
          <label class="choice">
            <input type="radio" name="hemisphere" value="south" :checked="garden.climate.hemisphere === 'south'" @change="update({ hemisphere: 'south' })" />
            <span>{{ t('climate.south') }}</span>
          </label>
        </div>
      </fieldset>
      <fieldset class="field">
        <legend>{{ t('climate.springStart') }}</legend>
        <div class="choice-group">
          <label class="choice" v-for="key in [...Object.keys(PRESETS), 'custom']" :key="key">
            <input type="radio" name="climate-preset" :value="key" :checked="preset === key" @change="choosePreset(key)" />
            <span>{{ t('climate.presets.' + key) }}</span>
          </label>
        </div>
      </fieldset>
      <div v-if="preset === 'custom'" class="field">
        <label for="last-frost">{{ t('climate.lastFrost') }}</label>
        <input id="last-frost" class="input" type="date" :value="lastFrost" min="2025-02-01" max="2025-07-31" @change="setLastFrost" />
        <p class="field-hint">{{ t('climate.lastFrostHint') }}</p>
      </div>
      <p class="field-hint">{{ t('climate.summary', { date: frostText }) }} {{ shiftText }}</p>
    </section>
  `,
};
