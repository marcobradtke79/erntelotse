// UI icon from the sprite. Decorative by default; pass `label` for icons without visible text.

const SPRITE = new URL('../../assets/icons/ui/sprite.svg', import.meta.url).href;

export default {
  name: 'AppIcon',
  props: {
    name: { type: String, required: true },
    label: { type: String, default: '' },
  },
  setup() {
    return { sprite: SPRITE };
  },
  template: `
    <svg class="icon" :aria-hidden="label ? null : 'true'" :role="label ? 'img' : null" :aria-label="label || null" focusable="false">
      <use :href="sprite + '#' + name" />
    </svg>
  `,
};
