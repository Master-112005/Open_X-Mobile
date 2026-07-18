import CryptoError from './CryptoErrors';

/**
 * Mobile replay protection manager.
 */
export class ReplayManager {
  /**
   * Creates replay manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.logger = options.logger;
    this.cache = new Map();
  }

  /**
   * Validates nonce and records it.
   * @param {string} nonce Nonce.
   * @returns {boolean} True when accepted.
   */
  validateNonce(nonce) {
    const value = String(nonce || '').trim();
    if (!value) throw new CryptoError('crypto.nonce_invalid', 'Nonce is required.');
    this.cleanup();
    if (this.cache.has(value)) {
      this.logger.warn('Mobile replay detected', { nonce: value });
      throw new CryptoError('crypto.replay_detected', 'Replay detected.');
    }
    this.cache.set(value, Date.now() + this.config.replayWindowMs);
    return true;
  }

  /**
   * Removes expired nonces.
   */
  cleanup() {
    const now = Date.now();
    for (const [nonce, expiresAt] of this.cache.entries()) {
      if (now >= expiresAt) this.cache.delete(nonce);
    }
  }
}

export default ReplayManager;
