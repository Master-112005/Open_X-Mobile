import MultiDeviceConfiguration from './MultiDeviceConfiguration';
import DeviceEvents from './DeviceEvents';
import DeviceLogger from './DeviceLogger';
import MultiDeviceClient from './MultiDeviceClient';
import SynchronizationCopyManager from './SynchronizationCopyManager';
import DeviceSynchronizationManager from './DeviceSynchronizationManager';
import DeviceConsistencyManager from './DeviceConsistencyManager';

/**
 * Mobile Phase 10 multi-device facade.
 */
export class MultiDeviceManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.config = options.config instanceof MultiDeviceConfiguration ? options.config : new MultiDeviceConfiguration(options.config || {});
    this.eventBus = options.eventBus;
    this.logger = options.logger || new DeviceLogger();
    this.client = options.client || new MultiDeviceClient({ config: this.config, fetchImpl: options.fetchImpl });
    this.copyManager = options.copyManager || new SynchronizationCopyManager({ config: this.config, storage: options.storage, eventBus: this.eventBus, events: DeviceEvents });
    this.synchronization = options.synchronization || new DeviceSynchronizationManager({ client: this.client, eventBus: this.eventBus, events: DeviceEvents });
    this.consistency = options.consistency || new DeviceConsistencyManager({ client: this.client, copyManager: this.copyManager, eventBus: this.eventBus, events: DeviceEvents });
  }

  /** @param {string} accountId AccountID. @returns {Promise<object>} Devices. */
  listDevices(accountId) { return this.client.listDevices(accountId); }

  /** @param {object} input Sync input. @returns {Promise<object>} Sync result. */
  synchronizeDevice(input = {}) { return this.synchronization.synchronize(input); }

  /** @param {object} input Consistency input. @returns {Promise<object>} Consistency result. */
  validateConsistency(input = {}) { return this.consistency.validate(input); }

  /** @param {string} deviceId DeviceID. @returns {Promise<object>} Status. */
  status(deviceId) { return this.consistency.status(deviceId); }
}

export default MultiDeviceManager;
