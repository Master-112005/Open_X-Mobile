import AsyncStorage from '@react-native-async-storage/async-storage';

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
    this.state = raw ? JSON.parse(raw) : {
      clientDeviceKey: this.createClientDeviceKey(),
      device: null,
      approvals: [],
      updatedAt: new Date().toISOString(),
    };
    if (!raw) await this.save();
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
    return `mobile-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  }
}

export default DeviceRegistry;
