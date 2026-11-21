const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Short random id with a type prefix, e.g. "g_k3x9a1m2qz". Safe for storage keys. */
export function newId(prefix, length = 10) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let id = '';
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
  return `${prefix}_${id}`;
}

export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
