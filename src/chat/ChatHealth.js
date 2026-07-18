/**
 * Builds Mobile Chat health snapshots.
 */
export class ChatHealth {
  /**
   * Creates a health helper.
   * @param {object} options Health dependencies.
   */
  constructor(options = {}) {
    this.statusManager = options.statusManager;
    this.connectionManager = options.connectionManager;
    this.versionManager = options.versionManager;
  }

  /**
   * Returns current health.
   * @returns {object} Health snapshot.
   */
  getHealth() {
    return Object.freeze({
      status: this.statusManager.getStatus(),
      connection: this.connectionManager?.getStatus?.() || null,
      version: this.versionManager.getVersion(),
      timestamp: new Date().toISOString(),
    });
  }
}

export default ChatHealth;
