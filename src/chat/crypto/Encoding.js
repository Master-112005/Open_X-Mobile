import forge from 'node-forge/lib/forge';

function bytes(input) {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function bytesToBinary(input) {
  let binary = '';
  bytes(input).forEach((byte) => { binary += String.fromCharCode(byte); });
  return binary;
}

function binaryToBytes(input) {
  const output = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) output[index] = input.charCodeAt(index);
  return output;
}

/**
 * Encodes bytes as base64url.
 * @param {ArrayBuffer|Uint8Array} input Bytes.
 * @returns {string} Base64url.
 */
export function toBase64(input) {
  return forge.util.encode64(bytesToBinary(input)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Decodes base64 to bytes.
 * @param {string} input Base64.
 * @returns {Uint8Array} Bytes.
 */
export function fromBase64(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return binaryToBytes(forge.util.decode64(padded));
}

/**
 * Encodes object as UTF-8 bytes.
 * @param {string} input Text.
 * @returns {Uint8Array} Bytes.
 */
export function utf8(input) {
  return binaryToBytes(forge.util.encodeUtf8(String(input || '')));
}

/**
 * Decodes UTF-8 bytes.
 * @param {ArrayBuffer|Uint8Array} input Bytes.
 * @returns {string} Text.
 */
export function text(input) {
  return forge.util.decodeUtf8(bytesToBinary(input));
}

export function toBinary(input) {
  return bytesToBinary(input);
}

export function fromBinary(input) {
  return binaryToBytes(input);
}
