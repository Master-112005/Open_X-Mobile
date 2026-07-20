import RandomManager from '../crypto/RandomManager';
import SecurityEvents from './SecurityEvents';

const random = new RandomManager();

function randomHex(bytes) {
  const values = random.bytes(bytes);
  return Array.from(values).map((value) => value.toString(16).padStart(2, '0')).join('');
}

/**
 * Mobile local security session manager.
 */
export class SessionManager {
  /**
   * Creates session manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.timeoutMs = Number(options.timeoutMs || 3600000);
    this.sessions = new Map();
  }

  /** @param {object} input Input. @returns {object} Session. */
  createLocalSession(input = {}) {
    const now = Date.now();
    const session = {
      sessionId: `local_sec_sess_${randomHex(16)}`,
      accountId: input.accountId,
      deviceId: input.deviceId,
      status: 'Active',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.timeoutMs).toISOString(),
    };
    this.sessions.set(session.sessionId, session);
    this.eventBus?.emit?.(SecurityEvents.SESSION_CHANGED, { sessionId: session.sessionId, status: session.status });
    return session;
  }

  /** @param {string} sessionId SessionID. @returns {object} Validation result. */
  validateLocalSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { valid: false, reason: 'not_found' };
    if (Date.now() >= Date.parse(session.expiresAt)) {
      session.status = 'Expired';
      return { valid: false, reason: 'expired', session };
    }
    return { valid: session.status === 'Active', session };
  }

  /** @param {string} sessionId SessionID. @returns {object|null} Session. */
  revokeLocalSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.status = 'Revoked';
    session.revokedAt = new Date().toISOString();
    this.eventBus?.emit?.(SecurityEvents.SESSION_CHANGED, { sessionId, status: session.status });
    return session;
  }
}

export default SessionManager;
