import { utf8 } from './Encoding';

/**
 * Mobile HKDF-SHA256 manager.
 */
export class HKDFManager {
  /**
   * Creates HKDF manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
  }

  /**
   * Derives key bytes.
   * @param {object} input Input.
   * @returns {Promise<ArrayBuffer>} Derived bytes.
   */
  async derive(input) {
    const key = await globalThis.crypto.subtle.importKey('raw', input.ikm, 'HKDF', false, ['deriveBits']);
    return globalThis.crypto.subtle.deriveBits({
      name: 'HKDF',
      hash: this.config.hkdfHash,
      salt: input.salt,
      info: typeof input.info === 'string' ? utf8(input.info) : input.info,
    }, key, Number(input.length || this.config.keySizeBytes) * 8);
  }

  /**
   * Derives a domain-separated subkey.
   * @param {object} input Input.
   * @returns {Promise<ArrayBuffer>} Derived bytes.
   */
  subkey(input) {
    return this.derive({
      ikm: input.rootKey,
      salt: input.salt,
      info: `OpenXChat:v${input.version || 1}:${input.context}`,
      length: input.length || this.config.keySizeBytes,
    });
  }
}

export default HKDFManager;
