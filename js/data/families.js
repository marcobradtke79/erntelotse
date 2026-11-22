// Botanical plant families (used for display and, from milestone 5, crop rotation).
// The common name is translated under families.<id>; the Latin name is shown as is.

export const FAMILIES = {
  adoxaceae: { latin: 'Adoxaceae' },
  amaranthaceae: { latin: 'Amaranthaceae' },
  amaryllidaceae: { latin: 'Amaryllidaceae' },
  apiaceae: { latin: 'Apiaceae' },
  asparagaceae: { latin: 'Asparagaceae' },
  asteraceae: { latin: 'Asteraceae' },
  brassicaceae: { latin: 'Brassicaceae' },
  caprifoliaceae: { latin: 'Caprifoliaceae' },
  cucurbitaceae: { latin: 'Cucurbitaceae' },
  ericaceae: { latin: 'Ericaceae' },
  fabaceae: { latin: 'Fabaceae' },
  grossulariaceae: { latin: 'Grossulariaceae' },
  hydrangeaceae: { latin: 'Hydrangeaceae' },
  lamiaceae: { latin: 'Lamiaceae' },
  poaceae: { latin: 'Poaceae' },
  polygonaceae: { latin: 'Polygonaceae' },
  rosaceae: { latin: 'Rosaceae' },
  solanaceae: { latin: 'Solanaceae' },
};

export const FAMILY_IDS = Object.keys(FAMILIES);
