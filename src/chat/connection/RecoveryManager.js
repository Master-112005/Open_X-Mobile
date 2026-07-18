/**
 * Mobile recovery manager for foreground and wake-triggered mailbox sync.
 */
export class RecoveryManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.connectionManager = options.connectionManager;
    this.synchronizationManager = options.synchronizationManager;
    this.networkMonitor = options.networkMonitor;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /** @param {object} input Recovery input. @returns {Promise<object>} Recovery result. */
  async recover(input = {}) {
    this.eventBus?.emit?.(this.events.RECOVERY_STARTED, { deviceId: input.deviceId, reason: input.reason || 'manual' });
    const network = await this.networkMonitor.getStatus();
    if (!network.shouldReconnect) return { recovered: false, reason: 'offline', network };
    if (this.connectionManager.state !== 'connected' && this.connectionManager.state !== 'ready') {
      await this.connectionManager.connect().catch(() => null);
    }
    const sync = input.deviceId && this.synchronizationManager
      ? await this.synchronizationManager.synchronize({ deviceId: input.deviceId, afterSequence: input.afterSequence || 0, limit: input.limit })
      : null;
    this.eventBus?.emit?.(this.events.RECOVERY_COMPLETED, { deviceId: input.deviceId, recovered: true });
    return { recovered: true, network, sync };
  }
}

export default RecoveryManager;
