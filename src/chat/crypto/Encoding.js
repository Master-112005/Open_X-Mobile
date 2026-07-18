/**
 * Encodes bytes as base64.
 * @param {ArrayBuffer|Uint8Array} input Bytes.
 * @returns {string} Base64.
 */
export function toBase64(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Decodes base64 to bytes.
 * @param {string} input Base64.
 * @returns {Uint8Array} Bytes.
 */
export function fromBase64(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * Encodes object as UTF-8 bytes.
 * @param {string} input Text.
 * @returns {Uint8Array} Bytes.
 */
export function utf8(input) {
  return new TextEncoder().encode(input);
}

/**
 * Decodes UTF-8 bytes.
 * @param {ArrayBuffer|Uint8Array} input Bytes.
 * @returns {string} Text.
 */
export function text(input) {
  return new TextDecoder().decode(input);
}
