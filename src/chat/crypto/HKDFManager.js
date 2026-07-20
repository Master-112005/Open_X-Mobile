import forge from 'node-forge/lib/forge';
import 'node-forge/lib/hmac';
import 'node-forge/lib/sha256';

import { fromBinary, toBinary, utf8 } from './Encoding';

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
    if (!globalThis.crypto?.subtle) return this.deriveWithForge(input);
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

  /**
   * Derives HKDF-SHA256 bytes with node-forge when WebCrypto is unavailable.
   * @param {object} input Input.
   * @returns {Uint8Array} Derived bytes.
   */
  deriveWithForge(input) {
    const length = Number(input.length || this.config.keySizeBytes);
    const salt = toBinary(input.salt || new Uint8Array(32));
    const ikm = toBinary(input.ikm || new Uint8Array());
    const info = toBinary(typeof input.info === 'string' ? utf8(input.info) : input.info || new Uint8Array());
    const extract = forge.hmac.create();
    extract.start('sha256', salt);
    extract.update(ikm);
    const prk = extract.digest().getBytes();
    let output = '';
    let previous = '';
    let counter = 1;
    while (output.length < length) {
      const expand = forge.hmac.create();
      expand.start('sha256', prk);
      expand.update(previous + info + String.fromCharCode(counter));
      previous = expand.digest().getBytes();
      output += previous;
      counter += 1;
    }
    return fromBinary(output.slice(0, length));
  }
}

export default HKDFManager;
