/**
 * Mobile local connection session tracker.
 */
export class SessionManager {
  /** Creates session manager. */
  constructor() {
    this.session = null;
  }

  /** @param {object} session Session payload. @returns {object} Session. */
  setSession(session = {}) {
    this.session = {
      sessionId: session.sessionId || null,
      expiresAt: session.sessionExpiresAt || session.expiresAt || null,
      status: session.sessionId ? 'Active' : 'Pending',
      updatedAt: new Date().toISOString(),
    };
    return this.session;
  }

  /** Clears local session. */
  clear() {
    this.session = null;
  }

  /** @returns {object|null} Session. */
  getSession() {
    return this.session;
  }
}

export default SessionManager;
