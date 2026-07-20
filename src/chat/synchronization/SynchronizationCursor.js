import AsyncStorage from '@react-native-async-storage/async-storage';

function id(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

/**
 * Stores durable mobile sync cursors in platform storage.
 */
export class SynchronizationCursor {
  /**
   * Creates cursor store.
   * @param {object} options Options.
   */
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
    return { version: 1, cursors: [], acknowledgementHistory: [], recoveryHistory: [], retryQueue: [], conflictLog: [], sequenceState: [], futureSnapshotPlaceholder: [] };
  }

  /**
   * Initializes cursor storage.
   */
  async initialize() {
    if (this.started) return;
    const value = await this.storage.getItem(this.config.storageKey);
    try {
      this.state = value ? this.normalize(JSON.parse(value)) : this.empty();
    } catch {
      this.state = this.empty();
      await this.storage.removeItem(this.config.storageKey);
    }
    if (!value) await this.persist();
    this.started = true;
  }

  /** @param {object} state State. @returns {object} Normalized state. */
  normalize(state = {}) {
    const empty = this.empty();
    return Object.fromEntries(Object.entries(empty).map(([key, value]) => [key, Array.isArray(value) ? (Array.isArray(state[key]) ? state[key] : value) : Number(state[key] || value)]));
  }

  /**
   * Gets or creates cursor.
   * @param {object} input Cursor input.
   * @returns {Promise<object>} Cursor.
   */
  async getOrCreate(input = {}) {
    await this.initialize();
    const deviceId = String(input.deviceId || '').trim().toLowerCase();
    let cursor = this.state.cursors.find((item) => item.deviceId === deviceId);
    if (!cursor) {
      cursor = {
        cursorId: id('cur'),
        deviceId,
        mailboxId: input.mailboxId || null,
        currentSequence: Number(input.currentSequence || 0),
        lastAck: Number(input.lastAck || 0),
        lastUpdated: new Date().toISOString(),
        status: 'Idle',
        metadata: {},
        futureCheckpoint: null,
      };
      this.state.cursors.push(cursor);
      await this.persist();
    }
    return cursor;
  }

  /**
   * Updates cursor.
   * @param {object} cursor Cursor.
   * @param {object} patch Patch.
   * @returns {Promise<object>} Updated cursor.
   */
  async update(cursor, patch = {}) {
    await this.initialize();
    const updated = {
      ...cursor,
      ...patch,
      currentSequence: Math.max(0, Number(patch.currentSequence ?? cursor.currentSequence ?? 0)),
      lastAck: Math.max(0, Number(patch.lastAck ?? cursor.lastAck ?? 0)),
      metadata: { ...(cursor.metadata || {}), ...(patch.metadata || {}) },
      lastUpdated: new Date().toISOString(),
    };
    const index = this.state.cursors.findIndex((item) => item.cursorId === updated.cursorId);
    if (index >= 0) this.state.cursors[index] = updated;
    else this.state.cursors.push(updated);
    await this.persist();
    this.eventBus?.emit?.(this.events.CURSOR_UPDATED, { deviceId: updated.deviceId, sequence: updated.currentSequence, status: updated.status });
    return updated;
  }

  /** @param {object} record ACK record. */
  async recordAck(record) {
    await this.initialize();
    this.state.acknowledgementHistory.push(record);
    await this.persist();
  }

  /** @param {object} record Recovery record. */
  async recordRecovery(record) {
    await this.initialize();
    this.state.recoveryHistory.push(record);
    await this.persist();
  }

  /** @param {object} record Conflict record. */
  async recordConflict(record) {
    await this.initialize();
    this.state.conflictLog.push(record);
    await this.persist();
  }

  /** @param {object} record Sequence state. */
  async recordSequenceState(record) {
    await this.initialize();
    const index = this.state.sequenceState.findIndex((item) => item.deviceId === record.deviceId);
    if (index >= 0) this.state.sequenceState[index] = record;
    else this.state.sequenceState.push(record);
    await this.persist();
  }

  /**
   * Persists state.
   */
  async persist() {
    await this.storage.setItem(this.config.storageKey, JSON.stringify(this.state));
  }
}

export default SynchronizationCursor;
