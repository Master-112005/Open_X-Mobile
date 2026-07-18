/**
 * Mobile background lifecycle manager.
 */
export class BackgroundManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.config = options.config;
    this.connectionManager = options.connectionManager;
    this.presenceManager = options.presenceManager;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /** @param {object} input Background input. @returns {object} State. */
  enterBackground(input = {}) {
    this.presenceManager.setPresence({ accountId: input.accountId, deviceId: input.deviceId, state: 'Background', source: 'app-state' });
    this.connectionManager?.sendInfrastructureEvent?.('connection:background', { reason: input.reason || 'app-background' });
    if (this.config.disconnectInBackground) this.connectionManager?.disconnect?.();
    this.eventBus?.emit?.(this.events.BACKGROUND, { deviceId: input.deviceId });
    return { state: 'Background', disconnected: this.config.disconnectInBackground };
  }

  /** @param {object} input Foreground input. @returns {object} State. */
  enterForeground(input = {}) {
    this.presenceManager.setPresence({ accountId: input.accountId, deviceId: input.deviceId, state: 'Foreground', source: 'app-state' });
    this.eventBus?.emit?.(this.events.FOREGROUND, { deviceId: input.deviceId });
    return { state: 'Foreground' };
  }
}

export default BackgroundManager;
