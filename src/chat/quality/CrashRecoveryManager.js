/**
 * Tracks Mobile Chat crash recovery readiness.
 */
export class CrashRecoveryManager {
  /**
   * Creates a crash recovery manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.releaseLogger = options.releaseLogger;
    this.maxCrashRecords = Number.isFinite(Number(options.maxCrashRecords)) ? Number(options.maxCrashRecords) : 25;
    this.crashes = [];
    this.recoveryPolicy = Object.freeze({
      reconnectOnForeground: true,
      preserveLocalEncryptedState: true,
      replayPendingSyncAfterRestart: true,
      clearVolatileSessionState: true,
      respectBatteryState: true,
    });
  }

  /**
   * Records a bounded crash record.
   * @param {object} crash Crash metadata.
   * @returns {object} Crash record.
   */
  recordCrash(crash = {}) {
    const record = Object.freeze({
      id: crash.id || `crash_${Date.now()}`,
      component: String(crash.component || 'chat'),
      reason: String(crash.reason || 'unknown'),
      recoverable: crash.recoverable !== false,
      timestamp: new Date().toISOString(),
    });
    this.crashes.push(record);
    if (this.crashes.length > this.maxCrashRecords) this.crashes.shift();
    this.releaseLogger?.record?.('crash.recorded', {
      component: record.component,
      recoverable: record.recoverable,
    });
    this.eventBus?.emit?.('chat:crash-recorded', record);
    return record;
  }

  /**
   * Returns crash recovery status.
   * @returns {object} Status.
   */
  getStatus() {
    return Object.freeze({
      ready: true,
      policy: this.recoveryPolicy,
      crashCount: this.crashes.length,
      lastCrash: this.crashes[this.crashes.length - 1] || null,
    });
  }
}

export default CrashRecoveryManager;
