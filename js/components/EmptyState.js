// Empty state with a small garden illustration, one sentence and one action (slot).

export default {
  name: 'EmptyState',
  props: {
    title: { type: String, required: true },
    text: { type: String, default: '' },
  },
  template: `
    <section class="empty-state">
      <svg class="empty-state-art" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle cx="92" cy="26" r="12" style="fill: var(--task-sow)" />
        <path d="M14 96h92" style="stroke: var(--task-fertilize); stroke-width: 4; stroke-linecap: round" />
        <rect x="22" y="80" width="76" height="16" rx="6" style="fill: var(--task-fertilize); opacity: .35" />
        <path d="M40 82V64" style="stroke: var(--task-plant); stroke-width: 4; stroke-linecap: round" />
        <path d="M40 66c0-10-7-15-17-15 0 10 7 15 17 15Z" style="fill: var(--task-plant)" />
        <path d="M40 70c0-9 6-14 15-14 0 9-6 14-15 14Z" style="fill: var(--task-plant); opacity: .7" />
        <path d="M78 82V58" style="stroke: var(--task-plant); stroke-width: 4; stroke-linecap: round" />
        <circle cx="78" cy="52" r="9" style="fill: var(--task-harvest)" />
        <path d="M74 44l4 4 4-4" style="stroke: var(--task-plant); stroke-width: 3; fill: none; stroke-linecap: round; stroke-linejoin: round" />
        <circle cx="60" cy="40" r="3" style="fill: var(--task-water)" />
        <circle cx="54" cy="30" r="2" style="fill: var(--task-water); opacity: .7" />
      </svg>
      <h2>{{ title }}</h2>
      <p class="muted" v-if="text">{{ text }}</p>
      <slot />
    </section>
  `,
};
