/**
 * Mobile crypto error.
 */
export class CryptoError extends Error {
  /**
   * Creates crypto error.
   * @param {string} code Stable code.
   * @param {string} message Message.
   * @param {object|null} details Details.
   */
  constructor(code, message, details = null) {
    super(message);
    this.name = 'CryptoError';
    this.code = code;
    this.details = details;
  }
}

export default CryptoError;
