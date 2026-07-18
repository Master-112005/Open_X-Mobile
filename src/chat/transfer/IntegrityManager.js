import { fromBase64 } from '../crypto/Encoding';

/**
 * Mobile transfer integrity manager.
 */
export class IntegrityManager {
  /**
   * Computes SHA-256.
   * @param {ArrayBuffer|Uint8Array|string} value Bytes.
   * @returns {Promise<string>} Hex digest.
   */
  async sha256(value) {
    const bytes = typeof value === 'string' ? fromBase64(value) : value instanceof Uint8Array ? value : new Uint8Array(value);
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
    return Array.from(digest).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verifies SHA-256.
   * @param {ArrayBuffer|Uint8Array|string} value Bytes.
   * @param {string} expectedHash Expected hash.
   * @returns {Promise<boolean>} True when verified.
   */
  async verify(value, expectedHash) {
    const actual = await this.sha256(value);
    if (actual !== String(expectedHash || '').toLowerCase()) throw new Error('File integrity verification failed.');
    return true;
  }
}

export default IntegrityManager;
