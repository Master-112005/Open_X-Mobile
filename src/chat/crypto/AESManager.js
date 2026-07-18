import CryptoError from './CryptoErrors';
import { fromBase64, toBase64, utf8 } from './Encoding';

/**
 * Mobile AES-GCM manager.
 */
export class AESManager {
  /**
   * Creates AES manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.random = options.random;
  }

  /**
   * Imports AES key.
   * @param {Uint8Array} key Key bytes.
   * @returns {Promise<CryptoKey>} Crypto key.
   */
  importKey(key) {
    return globalThis.crypto.subtle.importKey('raw', key, { name: this.config.aesAlgorithm }, false, ['encrypt', 'decrypt']);
  }

  /**
   * Encrypts plaintext.
   * @param {object} input Input.
   * @returns {Promise<object>} Envelope.
   */
  async encrypt(input) {
    const iv = input.iv || this.random.iv();
    const cryptoKey = await this.importKey(input.key);
    const plaintext = typeof input.plaintext === 'string' ? utf8(input.plaintext) : input.plaintext;
    const aad = input.aad ? (typeof input.aad === 'string' ? utf8(input.aad) : input.aad) : undefined;
    const encrypted = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: this.config.aesAlgorithm, iv, additionalData: aad }, cryptoKey, plaintext));
    const ciphertext = encrypted.slice(0, encrypted.byteLength - this.config.tagSizeBytes);
    const tag = encrypted.slice(encrypted.byteLength - this.config.tagSizeBytes);
    return {
      algorithm: this.config.aesAlgorithm,
      iv: toBase64(iv),
      ciphertext: toBase64(ciphertext),
      tag: toBase64(tag),
      aad: aad ? toBase64(aad) : null,
      futureStreaming: false,
    };
  }

  /**
   * Decrypts envelope.
   * @param {object} input Input.
   * @returns {Promise<ArrayBuffer>} Plaintext.
   */
  async decrypt(input) {
    try {
      const cryptoKey = await this.importKey(input.key);
      const aad = input.aad ? fromBase64(input.aad) : undefined;
      const ciphertext = fromBase64(input.ciphertext);
      const tag = fromBase64(input.tag);
      const combined = new Uint8Array(ciphertext.byteLength + tag.byteLength);
      combined.set(ciphertext, 0);
      combined.set(tag, ciphertext.byteLength);
      return await globalThis.crypto.subtle.decrypt({
        name: this.config.aesAlgorithm,
        iv: fromBase64(input.iv),
        additionalData: aad,
      }, cryptoKey, combined);
    } catch (error) {
      throw new CryptoError('crypto.auth_failed', 'AES-GCM authentication failed.');
    }
  }
}

export default AESManager;
