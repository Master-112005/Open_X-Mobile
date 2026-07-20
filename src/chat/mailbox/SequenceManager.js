import AsyncStorage from '@react-native-async-storage/async-storage';
import MailboxEvents from './MailboxEvents';

/**
 * Persists local highest acknowledged mailbox sequences.
 */
export class SequenceManager {
  /**
   * Creates sequence manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.eventBus = options.eventBus;
    this.storage = options.storage || AsyncStorage;
    this.sequences = new Map();
    this.loaded = false;
  }

  /**
   * Loads sequence state.
   */
  async load() {
    if (this.loaded) return;
    const raw = await this.storage.getItem(this.config.sequenceStorageKey);
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      await this.storage.removeItem(this.config.sequenceStorageKey);
    }
    for (const [deviceId, sequence] of Object.entries(parsed?.sequences || {})) this.sequences.set(deviceId, Number(sequence || 0));
    this.loaded = true;
  }

  /**
   * Gets last acknowledged sequence.
   * @param {string} deviceId DeviceID.
   * @returns {Promise<number>} Sequence.
   */
  async getLastAcknowledgedSequence(deviceId) {
    await this.load();
    return Number(this.sequences.get(deviceId) || 0);
  }

  /**
   * Advances local acknowledged sequence.
   * @param {string} deviceId DeviceID.
   * @param {number} sequence Sequence.
   * @returns {Promise<number>} Stored sequence.
   */
  async updateLastAcknowledgedSequence(deviceId, sequence) {
    await this.load();
    const next = Math.max(Number(this.sequences.get(deviceId) || 0), Number(sequence || 0));
    this.sequences.set(deviceId, next);
    await this.persist();
    this.eventBus?.emit?.(MailboxEvents.SEQUENCE_UPDATED, { deviceId, sequence: next });
    return next;
  }

  /**
   * Persists sequence state.
   */
  async persist() {
    await this.storage.setItem(this.config.sequenceStorageKey, JSON.stringify({
      schemaVersion: 1,
      sequences: Object.fromEntries(this.sequences),
    }));
  }
}

export default SequenceManager;
