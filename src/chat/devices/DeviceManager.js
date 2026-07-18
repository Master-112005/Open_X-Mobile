import DeviceConfiguration from './DeviceConfiguration';
import DeviceEvents from './DeviceEvents';
import DeviceLifecycle from './DeviceLifecycle';
import DeviceLogger from './DeviceLogger';
import DeviceRegistry from './DeviceRegistry';
import DeviceService from './DeviceService';

/**
 * Mobile trusted device composition root.
 */
export class DeviceManager {
  /**
   * Creates a manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof DeviceConfiguration ? options.config : new DeviceConfiguration(options.config || {});
    this.logger = options.logger || new DeviceLogger();
    this.eventBus = options.eventBus;
    this.registry = options.registry || new DeviceRegistry({ root: this.config.storageRoot });
    this.lifecycle = options.lifecycle || new DeviceLifecycle();
    this.service = options.service || new DeviceService({ config: this.config, fetchImpl: options.fetchImpl });
  }

  /**
   * Starts device management and auto-registers when AccountID is configured.
   * @returns {Promise<object|null>} Device state.
   */
  async start() {
    await this.registry.load();
    if (!this.config.autoRegister || !this.config.accountId) {
      this.emit(DeviceEvents.AUTO_REGISTER_SKIPPED, { reason: 'missing-account-or-disabled' });
      return this.registry.getDevice();
    }
    return this.ensureRegistered();
  }

  /**
   * Ensures this mobile installation is registered.
   * @returns {Promise<object>} Device state.
   */
  async ensureRegistered() {
    const existing = await this.registry.getDevice();
    if (this.lifecycle.isTrusted(existing) || existing?.deviceStatus === 'Pending') return existing;
    try {
      const clientDeviceKey = await this.registry.getClientDeviceKey();
      const result = await this.service.registerDevice({
        accountId: this.config.accountId,
        deviceName: this.config.deviceName,
        platform: this.config.platform,
        platformVersion: this.config.platformVersion,
        applicationVersion: this.config.applicationVersion,
        operatingSystem: this.config.operatingSystem,
        deviceType: this.config.deviceType,
        capabilities: this.config.capabilities,
        clientDeviceKey,
      });
      await this.registry.setDevice(result.device, result.approval);
      this.emit(DeviceEvents.REGISTERED, { device: result.device, approval: result.approval });
      return result.device;
    } catch (error) {
      this.logger.warn('Mobile device auto-registration failed', { error: error.message });
      this.emit(DeviceEvents.AUTO_REGISTER_FAILED, { error: error.message });
      throw error;
    }
  }

  /**
   * Returns current device.
   * @returns {Promise<object|null>} Device.
   */
  getDevice() {
    return this.registry.getDevice();
  }

  /**
   * Emits event.
   * @param {string} eventName Event name.
   * @param {object} payload Payload.
   */
  emit(eventName, payload = {}) {
    this.eventBus?.emit?.(eventName, payload);
  }
}

export default DeviceManager;
