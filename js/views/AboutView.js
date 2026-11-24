// About: what Erntelotse is and what it is good for. The start page while there is no
// garden yet, and the first navigation entry after that.

import { useI18n } from 'vue-i18n';
import { gardens } from '../stores/gardens.js';
import AppIcon from '../components/AppIcon.js';
import LegalLinks from '../components/LegalLinks.js';

const BENEFITS = [
  { id: 'map', icon: 'map' },
  { id: 'time', icon: 'history' },
  { id: 'hints', icon: 'calendar' },
  { id: 'rotation', icon: 'refresh' },
  { id: 'seeds', icon: 'seed' },
  { id: 'private', icon: 'lock' },
];
const STEPS = ['s1', 's2', 's3'];
const NOTES = ['languages', 'services', 'guidance'];

export default {
  name: 'AboutView',
  components: { AppIcon, LegalLinks },
  setup() {
    const { t } = useI18n();
    return { t, gardens, BENEFITS, STEPS, NOTES };
  },
  template: `
    <div class="page about">
      <header class="about-hero">
        <span class="about-logo"><AppIcon name="sprout" /></span>
        <div>
          <p class="about-name">{{ t('app.name') }} · {{ t('app.tagline') }}</p>
          <h1>{{ t('about.title') }}</h1>
          <p class="about-lead">{{ t('about.lead') }}</p>
          <div class="btn-row">
            <router-link v-if="gardens.index.length === 0" to="/gardens" class="btn btn-primary">
              <AppIcon name="plus" />
              <span>{{ t('about.start') }}</span>
            </router-link>
            <router-link v-else to="/dashboard" class="btn btn-primary">
              <AppIcon name="dashboard" />
              <span>{{ t('about.toDashboard') }}</span>
            </router-link>
            <router-link to="/plants" class="btn btn-secondary">
              <AppIcon name="leaf" />
              <span>{{ t('about.toPlants') }}</span>
            </router-link>
          </div>
        </div>
      </header>

      <section aria-labelledby="about-benefits">
        <h2 id="about-benefits">{{ t('about.benefitsTitle') }}</h2>
        <ul class="card-grid plain-list" role="list">
          <li v-for="benefit in BENEFITS" :key="benefit.id" class="card about-benefit">
            <span class="about-benefit-icon"><AppIcon :name="benefit.icon" /></span>
            <h3>{{ t('about.benefits.' + benefit.id + '.title') }}</h3>
            <p>{{ t('about.benefits.' + benefit.id + '.text') }}</p>
          </li>
        </ul>
      </section>

      <div class="about-columns">
        <section class="card" aria-labelledby="about-steps">
          <div class="card-header">
            <AppIcon name="seedling" />
            <h2 id="about-steps">{{ t('about.stepsTitle') }}</h2>
          </div>
          <ol class="about-steps">
            <li v-for="step in STEPS" :key="step">{{ t('about.steps.' + step) }}</li>
          </ol>
        </section>

        <section class="card" aria-labelledby="about-notes">
          <div class="card-header">
            <AppIcon name="info" />
            <h2 id="about-notes">{{ t('about.noteTitle') }}</h2>
          </div>
          <ul class="about-notes">
            <li v-for="note in NOTES" :key="note">{{ t('about.notes.' + note) }}</li>
          </ul>
        </section>
      </div>

      <LegalLinks />
    </div>
  `,
};
