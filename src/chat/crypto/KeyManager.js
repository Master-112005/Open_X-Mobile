import forge from 'node-forge/lib/forge';
import 'node-forge/lib/sha256';

import { toBase64, utf8 } from './Encoding';

/**
 * Mobile key manager.
 */
export class KeyManager {
  /**
   * Creates key manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.storage = options.storage;
    this.logger = options.logger;
  }

  /** @returns {Promise<object>} Identity key pair. */
  generateIdentityKeyPair() { return this.generateKeyPair('identity', this.config.identityAlgorithm); }

  /** @returns {Promise<object>} Device key pair. */
  generateDeviceKeyPair() { return this.generateKeyPair('device', this.config.deviceAlgorithm); }

  /**
   * Generates key pair.
   * @param {string} keyType Type.
   * @param {object} algorithm Algorithm.
   * @returns {Promise<object>} Key pair.
   */
  async generateKeyPair(keyType, algorithm) {
    if (!globalThis.crypto?.subtle) {
      throw new Error('Mobile WebCrypto key-pair generation is unavailable on this device build.');
    }
    const pair = await globalThis.crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
    const publicJwk = await globalThis.crypto.subtle.exportKey('jwk', pair.publicKey);
    const privateJwk = await globalThis.crypto.subtle.exportKey('jwk', pair.privateKey);
    const fingerprint = await this.fingerprint(publicJwk);
    this.logger.info('Mobile crypto key pair generated', { keyType, fingerprint });
    return {
      keyType,
      algorithm: algorithm.name,
      publicKey: publicJwk,
      privateKey: privateJwk,
      fingerprint,
      keyVersion: 1,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Stores private key locally.
   * @param {string} name Secret name.
   * @param {object} keyPair Key pair.
   */
  async storePrivateKey(name, keyPair) {
    await this.storage.setSecret(name, keyPair);
  }

  /**
   * Reads private key.
   * @param {string} name Secret name.
   * @returns {Promise<object|null>} Key pair.
   */
  getPrivateKey(name) {
    return this.storage.getSecret(name);
  }

  /**
   * Generates fingerprint.
   * @param {object} publicKey Public JWK.
   * @returns {Promise<string>} Fingerprint.
   */
  async fingerprint(publicKey) {
    const payload = JSON.stringify(Object.keys(publicKey).sort().reduce((output, key) => {
      output[key] = publicKey[key];
      return output;
    }, {}));
    const digest = forge.md.sha256.create();
    digest.update(payload, 'utf8');
    return `fp:v1:sha256:${digest.digest().toHex()}`;
  }

  /**
   * Exports public key as transport-safe value.
   * @param {object} publicKey Public key.
   * @returns {string} Encoded public key.
   */
  exportPublicKey(publicKey) {
    return toBase64(utf8(JSON.stringify(publicKey)));
  }
}

export default KeyManager;
