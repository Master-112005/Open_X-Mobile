import AsyncStorage from '@react-native-async-storage/async-storage';
import { text, utf8 } from './Encoding';

/**
 * Encrypted mobile storage for private keys and future session keys.
 */
export class SecureStorageManager {
  /**
   * Creates storage manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.aes = options.aes;
    this.random = options.random;
    this.root = this.config.storageRoot;
    this.wrappingKey = this.config.wrappingKey || this.random.key();
  }

  /**
   * Initializes storage.
   */
  async initialize() {
    const exists = await AsyncStorage.getItem(`${this.root}/initialized`);
    if (!exists) await AsyncStorage.setItem(`${this.root}/initialized`, 'true');
  }

  /**
   * Stores encrypted secret.
   * @param {string} name Name.
   * @param {*} value Value.
   */
  async setSecret(name, value) {
    const envelope = await this.aes.encrypt({
      key: this.wrappingKey,
      plaintext: JSON.stringify(value),
      aad: `openx-mobile-chat:${name}`,
    });
    await AsyncStorage.setItem(`${this.root}/${name}`, JSON.stringify(envelope));
  }

  /**
   * Reads encrypted secret.
   * @param {string} name Name.
   * @returns {Promise<*>} Secret.
   */
  async getSecret(name) {
    const raw = await AsyncStorage.getItem(`${this.root}/${name}`);
    if (!raw) return null;
    const envelope = JSON.parse(raw);
    const plaintext = await this.aes.decrypt({
      key: this.wrappingKey,
      iv: envelope.iv,
      ciphertext: envelope.ciphertext,
      tag: envelope.tag,
      aad: envelope.aad,
    });
    return JSON.parse(text(plaintext));
  }

  /**
   * Deletes secret.
   * @param {string} name Name.
   */
  async deleteSecret(name) {
    await AsyncStorage.removeItem(`${this.root}/${name}`);
  }
}

export default SecureStorageManager;
