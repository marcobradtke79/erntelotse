// The provider of the app, shown in the legal notice (§ 5 DDG) and the privacy notice.
// Language-neutral; `country` is an ISO 3166 code. tests/provider.test.js fails while a
// field is empty, so the pages cannot go live without these details.

export const PROVIDER = {
  name: 'Marco Bradtke',
  street: 'Edmund-Wellenstein-Str. 6',
  postalCode: '40885',
  city: 'Ratingen',
  country: 'DE',
  email: 'marco.bradtke@googlemail.com',
  phone: '02102/7006495',
};

/** Date (ISO) of the current privacy notice */
export const PRIVACY_DATE = '2026-11-24';
