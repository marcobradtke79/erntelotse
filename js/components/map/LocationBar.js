// Placing the garden on the map: search a place, use the device position, or pan
// the map so the cross is on the garden.

import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { searchPlace, GeocodeError } from '../../services/geocode.js';
import AppIcon from '../AppIcon.js';

export default {
  name: 'LocationBar',
  components: { AppIcon },
  props: {
    hasLocation: { type: Boolean, default: false },
  },
  emits: ['fly', 'confirm', 'cancel', 'remove'],
  setup(props, { emit }) {
    const { t, locale } = useI18n();
    const query = ref('');
    const results = ref(null);
    const busy = ref(false);
    const message = ref('');

    async function search() {
      const text = query.value.trim();
      if (!text || busy.value) return;
      busy.value = true;
      message.value = '';
      try {
        results.value = await searchPlace(text, locale.value);
        if (results.value.length === 0) message.value = t('map.location.noResults');
      } catch (error) {
        results.value = null;
        message.value = t(error instanceof GeocodeError && error.code === 'offline' ? 'map.location.offline' : 'map.location.searchFailed');
      } finally {
        busy.value = false;
      }
    }

    function choose(result) {
      results.value = null;
      emit('fly', { lat: result.lat, lng: result.lng, zoom: 19 });
    }

    function myPosition() {
      if (!navigator.geolocation) {
        message.value = t('map.location.positionFailed');
        return;
      }
      busy.value = true;
      message.value = '';
      navigator.geolocation.getCurrentPosition(
        (position) => {
          busy.value = false;
          emit('fly', { lat: position.coords.latitude, lng: position.coords.longitude, zoom: 20 });
        },
        () => {
          busy.value = false;
          message.value = t('map.location.positionFailed');
        },
        { enableHighAccuracy: true, timeout: 15000 },
      );
    }

    return { t, query, results, busy, message, search, choose, myPosition };
  },
  template: `
    <section class="location-bar" aria-labelledby="location-title">
      <h2 id="location-title">{{ t(hasLocation ? 'map.location.changeTitle' : 'map.location.title') }}</h2>
      <p class="small">{{ t('map.location.hint') }}</p>
      <form class="location-search" role="search" @submit.prevent="search">
        <label for="location-query" class="visually-hidden">{{ t('map.location.searchLabel') }}</label>
        <input id="location-query" v-model="query" class="input" type="search" autocomplete="off" :placeholder="t('map.location.searchPlaceholder')" />
        <button type="submit" class="btn btn-secondary" :disabled="busy">
          <AppIcon name="search" />
          <span>{{ t('map.location.search') }}</span>
        </button>
      </form>
      <ul v-if="results && results.length" class="plain-list location-results">
        <li v-for="(result, index) in results" :key="index">
          <button type="button" class="menu-item" @click="choose(result)">
            <AppIcon name="pin" />
            <span>{{ result.name }}</span>
          </button>
        </li>
      </ul>
      <p v-if="message" class="field-error" role="status">{{ message }}</p>
      <p class="field-hint">{{ t('map.location.searchNote') }}</p>
      <div class="btn-row">
        <button type="button" class="btn btn-text" :disabled="busy" @click="myPosition">
          <AppIcon name="target" />
          <span>{{ t('map.location.myPosition') }}</span>
        </button>
        <button v-if="hasLocation" type="button" class="btn btn-text" @click="$emit('remove')">
          <AppIcon name="close" />
          <span>{{ t('map.location.remove') }}</span>
        </button>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn btn-text" @click="$emit('cancel')">{{ t('common.cancel') }}</button>
        <button type="button" class="btn btn-primary" @click="$emit('confirm')">
          <AppIcon name="pin" />
          <span>{{ t('map.location.setHere') }}</span>
        </button>
      </div>
    </section>
  `,
};
