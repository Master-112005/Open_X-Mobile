import forge from 'node-forge/lib/forge';
import 'node-forge/lib/sha256';

import { fromBase64, toBinary } from '../crypto/Encoding';

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
    const digest = forge.md.sha256.create();
    digest.update(toBinary(bytes), 'raw');
    return digest.digest().toHex();
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
