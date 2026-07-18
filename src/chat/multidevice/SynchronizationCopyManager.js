import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Mobile local synchronization-copy metadata store.
 */
export class SynchronizationCopyManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.config = options.config;
    this.storage = options.storage || AsyncStorage;
    this.eventBus = options.eventBus;
    this.events = options.events;
    this.state = this.empty();
    this.started = false;
  }

  /** @returns {object} Empty state. */
  empty() {
    return { version: 1, synchronizationCopies: [], deviceSynchronization: [], deviceConsistency: [], deviceQueues: [], routingHistory: [], futureGroupRouting: [] };
  }

  /**
   * Initializes storage.
   */
  async initialize() {
    if (this.started) return;
    const value = await this.storage.getItem(this.config.storageKey);
    this.state = value ? this.normalize(JSON.parse(value)) : this.empty();
    if (!value) await this.persist();
    this.started = true;
  }

  /** @param {object} state State. @returns {object} Normalized state. */
  normalize(state = {}) {
    const empty = this.empty();
    return {
      version: Number(state.version || 1),
      ...Object.fromEntries(Object.keys(empty).filter((key) => key !== 'version').map((key) => [key, Array.isArray(state[key]) ? state[key] : []])),
    };
  }

  /** @param {object} copy Copy record. */
  async recordCopy(copy) {
    await this.initialize();
    this.state.synchronizationCopies.push(copy);
    await this.persist();
    this.eventBus?.emit?.(this.events.SYNCHRONIZATION_COPY_CREATED, { copyId: copy.copyId, targetDeviceId: copy.targetDeviceId });
  }

  /** @param {object} consistency Consistency record. */
  async recordConsistency(consistency) {
    await this.initialize();
    this.state.deviceConsistency.push(consistency);
    await this.persist();
    this.eventBus?.emit?.(this.events.CONSISTENCY_UPDATED, { consistent: consistency.consistent });
  }

  /** @param {object} queue Queue record. */
  async recordQueue(queue) {
    await this.initialize();
    const index = this.state.deviceQueues.findIndex((item) => item.deviceId === queue.deviceId);
    if (index >= 0) this.state.deviceQueues[index] = queue;
    else this.state.deviceQueues.push(queue);
    await this.persist();
    this.eventBus?.emit?.(this.events.DEVICE_QUEUE_UPDATED, { deviceId: queue.deviceId, currentSequence: queue.currentSequence });
  }

  /**
   * Persists state.
   */
  async persist() {
    await this.storage.setItem(this.config.storageKey, JSON.stringify(this.state));
  }
}

export default SynchronizationCopyManager;
