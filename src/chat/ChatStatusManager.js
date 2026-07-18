/**
 * Tracks Mobile Chat lifecycle and connection status.
 */
export class ChatStatusManager {
  /**
   * Creates a status manager.
   */
  constructor() {
    this.state = 'offline';
    this.lastChangedAt = new Date().toISOString();
    this.lastError = null;
  }

  /**
   * Updates status.
   * @param {string} state New state.
   * @param {object} details State details.
   */
  setState(state, details = {}) {
    this.state = String(state || 'offline');
    this.lastChangedAt = new Date().toISOString();
    this.lastError = details.error || null;
  }

  /**
   * Returns status snapshot.
   * @returns {object} Status snapshot.
   */
  getStatus() {
    return Object.freeze({
      state: this.state,
      lastChangedAt: this.lastChangedAt,
      lastError: this.lastError,
    });
  }
}

export default ChatStatusManager;
