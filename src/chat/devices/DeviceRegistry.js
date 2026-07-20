import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

/**
 * Persists local mobile device registration state.
 */
export class DeviceRegistry {
  /**
   * Creates a registry.
   * @param {object} options Registry options.
   */
  constructor(options = {}) {
    this.root = options.root || '@openx-chat/device';
    this.stateKey = `${this.root}/state`;
    this.state = null;
  }

  /**
   * Loads local state.
   * @returns {Promise<object>} State.
   */
  async load() {
    if (this.state) return this.state;
    const raw = await AsyncStorage.getItem(this.stateKey);
    let shouldSave = !raw;
    try {
      this.state = raw ? JSON.parse(raw) : null;
    } catch {
      await AsyncStorage.removeItem(this.stateKey);
      this.state = null;
      shouldSave = true;
    }
    this.state = this.state && typeof this.state === 'object' && !Array.isArray(this.state) ? this.state : {
      clientDeviceKey: this.createClientDeviceKey(),
      device: null,
      approvals: [],
      updatedAt: new Date().toISOString(),
    };
    if (!this.state.clientDeviceKey) {
      this.state.clientDeviceKey = this.createClientDeviceKey();
      shouldSave = true;
    }
    if (!Array.isArray(this.state.approvals)) {
      this.state.approvals = [];
      shouldSave = true;
    }
    if (shouldSave) await this.save();
    return this.state;
  }

  /**
   * Saves state.
   */
  async save() {
    await AsyncStorage.setItem(this.stateKey, JSON.stringify(this.state));
  }

  /**
   * Stores device state.
   * @param {object} device Device.
   * @param {object|null} approval Approval.
   */
  async setDevice(device, approval = null) {
    await this.load();
    this.state.device = device;
    if (approval) this.state.approvals.push(approval);
    this.state.updatedAt = new Date().toISOString();
    await this.save();
  }

  /**
   * Returns current device.
   * @returns {Promise<object|null>} Device.
   */
  async getDevice() {
    return (await this.load()).device || null;
  }

  /**
   * Returns local client key.
   * @returns {Promise<string>} Client key.
   */
  async getClientDeviceKey() {
    return (await this.load()).clientDeviceKey;
  }

  /**
   * Creates a local client key. The server still generates the trusted DeviceID.
   * @returns {string} Client key.
   */
  createClientDeviceKey() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    if (typeof Crypto.randomUUID === 'function') return Crypto.randomUUID();
    throw new Error('Secure mobile device key generation is unavailable.');
  }
}

export default DeviceRegistry;
