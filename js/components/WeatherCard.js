// Weather card on the dashboard: notes for the garden (frost, watering) and the next days.
// Renders nothing without a forecast (weather off, no location, offline without cache).

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWeather } from '../stores/weather.js';
import { settings } from '../stores/settings.js';
import { catalog, plantNameById } from '../stores/catalog.js';
import { weatherNotes, FROST_THRESHOLD, HOT_DAY } from '../logic/weatherRules.js';
import { formatTemperature, formatPrecipitation } from '../logic/units.js';
import { todayIso } from '../logic/dates.js';
import AppIcon from './AppIcon.js';

const NOTE_ICONS = { frost: 'snowflake', water: 'watering-can', rained: 'cloud-rain' };
const SKY_KEYS = { snowflake: 'frost', 'cloud-rain': 'rain', sun: 'sunny', 'cloud-sun': 'mixed' };

function dayIcon(day) {
  if (day.tMin !== null && day.tMin <= FROST_THRESHOLD) return 'snowflake';
  if (day.rain !== null && day.rain >= 1) return 'cloud-rain';
  if (day.tMax !== null && day.tMax >= HOT_DAY) return 'sun';
  return 'cloud-sun';
}

export default {
  name: 'WeatherCard',
  components: { AppIcon },
  props: {
    garden: { type: Object, required: true },
  },
  setup(props) {
    const { t, locale } = useI18n();
    const weather = useWeather();
    const today = todayIso();

    const shown = computed(() => weather.gardenId === props.garden.id && weather.days.some((day) => day.date >= today));
    const temp = (value) => (value === null ? '–' : formatTemperature(value, settings.units, locale.value));
    const rain = (value) => formatPrecipitation(value ?? 0, settings.units, locale.value);
    const weekday = computed(() => new Intl.DateTimeFormat(locale.value, { weekday: 'short', timeZone: 'UTC' }));
    const longDay = computed(() => new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }));
    const date = (iso) => new Date(`${iso}T00:00:00Z`);

    const notes = computed(() => {
      if (!shown.value) return [];
      return weatherNotes({ days: weather.days, garden: props.garden, catalog: catalog.value, today }).map((note) => {
        let text;
        if (note.kind === 'frost') {
          const plants = note.plantIds.map((id) => plantNameById(id, t)).join(', ');
          const day = note.date === today ? t('weather.today') : longDay.value.format(date(note.date));
          text = t('weather.notes.frost', { day: day.charAt(0).toLocaleUpperCase(locale.value) + day.slice(1), temperature: temp(note.tMin), plants });
        } else if (note.kind === 'water') {
          text = t('weather.notes.water');
        } else {
          text = t('weather.notes.rained', { amount: rain(note.mm) });
        }
        return { kind: note.kind, icon: NOTE_ICONS[note.kind], text };
      });
    });

    const days = computed(() => weather.days.filter((day) => day.date >= today).slice(0, 7).map((day) => {
      const icon = dayIcon(day);
      return {
        date: day.date,
        name: day.date === today ? t('weather.today') : weekday.value.format(date(day.date)),
        label: t(`weather.sky.${SKY_KEYS[icon]}`),
        icon,
        min: temp(day.tMin),
        max: temp(day.tMax),
        rain: day.rain !== null && day.rain >= 0.5 ? rain(day.rain) : '',
      };
    }));

    const updated = computed(() => (weather.fetchedAt
      ? new Intl.DateTimeFormat(locale.value, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(weather.fetchedAt))
      : ''));

    return { t, shown, notes, days, updated, weather };
  },
  template: `
    <section v-if="shown" class="card weather-card" aria-labelledby="dashboard-weather">
      <div class="card-header">
        <AppIcon name="cloud-sun" />
        <h2 id="dashboard-weather">{{ t('weather.title') }}</h2>
      </div>
      <ul v-if="notes.length" class="plain-list weather-notes">
        <li v-for="note in notes" :key="note.kind" class="weather-note" :class="'is-' + note.kind">
          <AppIcon :name="note.icon" />
          <span>{{ note.text }}</span>
        </li>
      </ul>
      <ol class="plain-list weather-days" :aria-label="t('weather.days')">
        <li v-for="day in days" :key="day.date" class="weather-day">
          <span class="weather-day-name">{{ day.name }}</span>
          <AppIcon :name="day.icon" :label="day.label" />
          <span class="weather-temps">
            <strong>{{ day.max }}</strong>
            <span class="muted">{{ day.min }}</span>
          </span>
          <span class="weather-rain small">{{ day.rain }}</span>
        </li>
      </ol>
      <p class="small muted weather-source">
        {{ t('weather.updated', { time: updated }) }}<span v-if="weather.stale"> · {{ t('weather.stale') }}</span>
        · <a href="https://open-meteo.com/" target="_blank" rel="noopener">{{ t('weather.source') }}</a>
      </p>
    </section>
  `,
};
