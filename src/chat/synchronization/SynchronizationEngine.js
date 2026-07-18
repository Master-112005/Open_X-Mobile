/**
 * Mobile reliable synchronization execution engine.
 */
export class SynchronizationEngine {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.config = options.config;
    this.client = options.client;
    this.cursorStore = options.cursorStore;
    this.sequenceManager = options.sequenceManager;
    this.ackManager = options.ackManager;
    this.recoveryManager = options.recoveryManager;
    this.conflictManager = options.conflictManager;
    this.retryManager = options.retryManager;
    this.messageManager = options.messageManager;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /** @param {object} input Sync input. @returns {Promise<object>} Sync result. */
  async synchronize(input = {}) {
    const deviceId = String(input.deviceId || '').trim().toLowerCase();
    let cursor = await this.cursorStore.getOrCreate({ deviceId });
    const afterSequence = Number(input.afterSequence ?? cursor.lastAck ?? cursor.currentSequence ?? 0);
    this.eventBus?.emit?.(this.events.SYNC_STARTED, { deviceId, afterSequence });
    cursor = await this.cursorStore.update(cursor, { status: 'Synchronizing', currentSequence: afterSequence });
    try {
      const sync = await this.client.synchronize({ deviceId, afterSequence, limit: input.limit || this.config.maxFetchLimit });
      cursor = await this.cursorStore.update(cursor, { status: 'Validating', mailboxId: sync.mailboxId || cursor.mailboxId });
      const envelopes = this.sequenceManager.sort(sync.envelopes || []);
      const localConflicts = this.conflictManager.detect(envelopes);
      if (localConflicts.duplicateCount || localConflicts.outOfOrder) await this.cursorStore.recordConflict({ deviceId, ...localConflicts, createdAt: new Date().toISOString() });
      const gaps = this.sequenceManager.detectGaps(envelopes, afterSequence);
      const recovery = this.recoveryManager.inspect(gaps);
      if (recovery.required) {
        await this.cursorStore.recordRecovery({ deviceId, ...recovery, createdAt: new Date().toISOString() });
        cursor = await this.cursorStore.update(cursor, { status: 'Interrupted', metadata: { recoveryRequired: true } });
        this.eventBus?.emit?.(this.events.SYNC_INTERRUPTED, { deviceId, gaps });
        return { sync, received: [], ack: null, cursor, recovery, conflicts: localConflicts };
      }
      cursor = await this.cursorStore.update(cursor, { status: 'Applying' });
      const received = [];
      const appliedSequences = [];
      for (const envelope of envelopes) {
        const result = this.messageManager?.receiveEnvelope ? await this.messageManager.receiveEnvelope({ ...input, envelope }) : { envelope, skipped: true };
        received.push(result);
        appliedSequences.push(Number(envelope.mailboxSequence || 0));
      }
      const highestContiguousSequence = this.sequenceManager.highestContiguous(appliedSequences, afterSequence);
      const ack = await this.ackManager.acknowledge({ deviceId, afterSequence, highestContiguousSequence });
      cursor = await this.cursorStore.update(cursor, {
        status: 'Completed',
        currentSequence: Math.max(Number(cursor.currentSequence || 0), Number(sync.currentMailboxSequence || highestContiguousSequence)),
        lastAck: Math.max(Number(cursor.lastAck || 0), highestContiguousSequence),
      });
      await this.cursorStore.recordSequenceState({ deviceId, currentMailboxSequence: sync.currentMailboxSequence, highestContiguousSequence, updatedAt: new Date().toISOString() });
      this.retryManager.reset();
      this.eventBus?.emit?.(this.events.SYNC_COMPLETED, { deviceId, count: received.length, sequence: highestContiguousSequence });
      return { sync, received, ack, cursor, recovery, conflicts: localConflicts };
    } catch (error) {
      const retryState = this.retryManager.recordFailure(error);
      cursor = await this.cursorStore.update(cursor, { status: 'Failed', metadata: { retryCount: retryState.retryCount, lastError: error.code || error.message } });
      this.eventBus?.emit?.(this.events.SYNC_FAILED, { deviceId, reason: error.code || error.message, retryState });
      throw error;
    }
  }

  /** @param {string} deviceId DeviceID. @returns {Promise<object>} Status. */
  status(deviceId) { return this.client.status(deviceId); }

  /** @param {object} input Retry input. @returns {Promise<object>} Retry result. */
  retry(input = {}) { return this.synchronize(input); }
}

export default SynchronizationEngine;
