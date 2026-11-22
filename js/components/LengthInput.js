// Number input for a length (or a plain number) in the user's units.
// v-model is always metres; the field shows metres or feet.

import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { parseNumber, toInputLength, fromInputLength, lengthInputUnit, formatNumber } from '../logic/units.js';
import { checkSize } from '../logic/elements.js';

let counter = 0;

export default {
  name: 'LengthInput',
  props: {
    modelValue: { type: Number, default: null },
    label: { type: String, required: true },
    units: { type: String, default: 'metric' },
    /** 'length' converts between m and ft; 'degrees' and 'plain' do not */
    quantity: { type: String, default: 'length' },
    min: { type: Number, default: null },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const { t, locale } = useI18n();
    const id = `length-input-${++counter}`;
    const text = ref('');
    const error = ref('');

    const unit = computed(() => {
      if (props.quantity === 'degrees') return '°';
      if (props.quantity === 'plain') return '';
      return lengthInputUnit(props.units);
    });

    function display(value) {
      if (value === null || value === undefined) return '';
      const shown = props.quantity === 'length' ? toInputLength(value, props.units) : value;
      return formatNumber(shown, locale.value, props.quantity === 'degrees' ? 1 : 3).replace(/ | /g, '');
    }

    watch(() => [props.modelValue, props.units, locale.value], () => {
      text.value = display(props.modelValue);
      error.value = '';
    }, { immediate: true });

    // The stored value may differ from the typed one (rounding, normalised rotation),
    // and may not change at all; show what is stored after each entry.
    function emitValue(value) {
      emit('update:modelValue', value);
      nextTick(() => {
        if (!error.value) text.value = display(props.modelValue);
      });
    }

    function commit() {
      const value = parseNumber(text.value);
      if (value === null) {
        error.value = t('map.errors.number');
        return;
      }
      if (props.quantity === 'length') {
        const metres = fromInputLength(value, props.units);
        const problem = checkSize(metres);
        if (problem) {
          error.value = t(`map.errors.${problem}`);
          return;
        }
        error.value = '';
        emitValue(metres);
        return;
      }
      if (props.min !== null && value < props.min) {
        error.value = t('map.errors.number');
        return;
      }
      error.value = '';
      emitValue(value);
    }

    return { id, text, error, unit, commit };
  },
  template: `
    <div class="field">
      <label :for="id">{{ label }}</label>
      <div class="input-with-unit">
        <input
          :id="id"
          v-model="text"
          class="input"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          :aria-invalid="error ? 'true' : 'false'"
          :aria-describedby="error ? id + '-error' : null"
          @change="commit"
          @keydown.enter.prevent="commit"
        />
        <span class="input-unit" v-if="unit" aria-hidden="true">{{ unit }}</span>
      </div>
      <p v-if="error" :id="id + '-error'" class="field-error">{{ error }}</p>
    </div>
  `,
};
