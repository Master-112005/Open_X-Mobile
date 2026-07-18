import CryptoError from './CryptoErrors';

/**
 * Mobile session framework manager.
 */
export class SessionManager {
  /**
   * Creates session manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.random = options.random;
    this.sessions = new Map();
    this.logger = options.logger;
  }

  /**
   * Creates session metadata and local key.
   * @param {object} input Input.
   * @returns {object} Public session metadata.
   */
  createSession(input = {}) {
    const now = Date.now();
    const session = {
      sessionId: this.random.sessionId(),
      localDeviceId: input.localDeviceId || null,
      remoteDeviceId: input.remoteDeviceId || null,
      sessionKey: this.random.key(),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + (input.ttlMs || this.config.sessionTtlMs)).toISOString(),
      state: 'active',
      metadata: input.metadata || {},
      futureRatcheting: { enabled: false },
      futureMultiDevice: { enabled: false },
    };
    this.sessions.set(session.sessionId, session);
    this.logger.info('Mobile crypto session created', { sessionId: session.sessionId });
    return this.toPublic(session);
  }

  /**
   * Validates a session.
   * @param {string} sessionId Session id.
   * @returns {object} Session.
   */
  validateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'active') throw new CryptoError('crypto.session_invalid', 'Session is invalid.');
    if (Date.now() >= Date.parse(session.expiresAt)) throw new CryptoError('crypto.session_expired', 'Session expired.');
    return session;
  }

  /** @param {string} sessionId Session id. */
  destroySession(sessionId) { this.sessions.delete(sessionId); }

  /**
   * Returns public metadata.
   * @param {object} session Session.
   * @returns {object} Public metadata.
   */
  toPublic(session) {
    return {
      sessionId: session.sessionId,
      localDeviceId: session.localDeviceId,
      remoteDeviceId: session.remoteDeviceId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      state: session.state,
      metadata: session.metadata,
      futureRatcheting: session.futureRatcheting,
      futureMultiDevice: session.futureMultiDevice,
    };
  }
}

export default SessionManager;
