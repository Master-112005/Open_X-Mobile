/**
 * Mobile heartbeat facade around the foreground WebSocket.
 */
export class HeartbeatManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.connectionManager = options.connectionManager;
  }

  /** Starts heartbeat. */
  start() {
    this.connectionManager?.startHeartbeat?.();
  }

  /** Stops heartbeat. */
  stop() {
    this.connectionManager?.stopHeartbeat?.();
  }

  /** @returns {object} Heartbeat status. */
  status() {
    return {
      lastPongAt: this.connectionManager?.lastPongAt || null,
      state: this.connectionManager?.state || 'offline',
    };
  }
}

export default HeartbeatManager;
