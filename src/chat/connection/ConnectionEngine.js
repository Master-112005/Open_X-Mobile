import ConnectionConfiguration from './ConnectionConfiguration';
import ConnectionEvents from './ConnectionEvents';
import ConnectionLogger from './ConnectionLogger';
import PresenceManager from './PresenceManager';
import HeartbeatManager from './HeartbeatManager';
import NetworkMonitor from './NetworkMonitor';
import SessionManager from './SessionManager';
import PushManager from './PushManager';
import BackgroundManager from './BackgroundManager';
import RecoveryManager from './RecoveryManager';
import WakeManager from './WakeManager';

/**
 * Mobile Phase 11 connection, push wake, and recovery engine.
 */
export class ConnectionEngine {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.config = options.config instanceof ConnectionConfiguration ? options.config : new ConnectionConfiguration(options.config || {});
    this.connectionManager = options.connectionManager;
    this.synchronizationManager = options.synchronizationManager;
    this.eventBus = options.eventBus;
    this.logger = options.logger || new ConnectionLogger();
    this.presenceManager = options.presenceManager || new PresenceManager({ eventBus: this.eventBus, events: ConnectionEvents });
    this.heartbeatManager = options.heartbeatManager || new HeartbeatManager({ connectionManager: this.connectionManager });
    this.networkMonitor = options.networkMonitor || new NetworkMonitor({ provider: options.networkProvider });
    this.sessionManager = options.sessionManager || new SessionManager();
    this.pushManager = options.pushManager || new PushManager({ config: this.config, fetchImpl: options.fetchImpl, tokenProvider: options.tokenProvider, eventBus: this.eventBus, events: ConnectionEvents });
    this.backgroundManager = options.backgroundManager || new BackgroundManager({ config: this.config, connectionManager: this.connectionManager, presenceManager: this.presenceManager, eventBus: this.eventBus, events: ConnectionEvents });
    this.recoveryManager = options.recoveryManager || new RecoveryManager({ connectionManager: this.connectionManager, synchronizationManager: this.synchronizationManager, networkMonitor: this.networkMonitor, eventBus: this.eventBus, events: ConnectionEvents });
    this.wakeManager = options.wakeManager || new WakeManager({ pushManager: this.pushManager, recoveryManager: this.recoveryManager, eventBus: this.eventBus, events: ConnectionEvents });
  }

  /** @param {object} input Foreground connection input. @returns {Promise<object>} Status. */
  async connectForeground(input = {}) {
    const status = await this.connectionManager.connect();
    if (input.accountId && input.deviceId) {
      this.connectionManager.sendInfrastructureEvent('connection:identify', {
        accountId: input.accountId,
        deviceId: input.deviceId,
        platform: input.platform || this.config.platform,
      });
      await this.pushManager.register(input).catch((error) => {
        this.logger.warn('Push token registration skipped', { error: error.message });
        return null;
      });
    }
    this.presenceManager.setPresence({ accountId: input.accountId, deviceId: input.deviceId, state: 'Foreground', source: 'foreground-connect' });
    if (this.config.syncOnForeground && input.deviceId && this.synchronizationManager) {
      this.eventBus?.emit?.(ConnectionEvents.SYNCHRONIZATION_REQUIRED, { deviceId: input.deviceId });
      await this.synchronizationManager.synchronize({ deviceId: input.deviceId, afterSequence: input.afterSequence || 0, limit: input.limit });
      this.eventBus?.emit?.(ConnectionEvents.SYNCHRONIZATION_COMPLETED, { deviceId: input.deviceId });
    }
    this.eventBus?.emit?.(ConnectionEvents.CONNECTED, { deviceId: input.deviceId });
    return status;
  }

  /** @param {object} session Session payload. @returns {object} Session. */
  acceptSession(session = {}) {
    return this.sessionManager.setSession(session);
  }

  /** @param {object} input Background input. @returns {object} Background state. */
  enterBackground(input = {}) {
    return this.backgroundManager.enterBackground(input);
  }

  /** @param {object} input Foreground input. @returns {Promise<object>} Recovery status. */
  async enterForeground(input = {}) {
    this.backgroundManager.enterForeground(input);
    return this.recoveryManager.recover({ ...input, reason: 'foreground' });
  }

  /** @param {object} input Push input. @returns {Promise<object>} Wake result. */
  handlePush(input = {}) {
    return this.wakeManager.handlePush(input);
  }

  /** @param {object} input Recovery input. @returns {Promise<object>} Recovery result. */
  recover(input = {}) {
    return this.recoveryManager.recover(input);
  }

  /** @returns {object} Status. */
  getStatus() {
    return {
      connection: this.connectionManager.getStatus(),
      presence: this.presenceManager.getPresence(),
      session: this.sessionManager.getSession(),
      heartbeat: this.heartbeatManager.status(),
    };
  }
}

ConnectionEngine.Events = ConnectionEvents;

export default ConnectionEngine;
