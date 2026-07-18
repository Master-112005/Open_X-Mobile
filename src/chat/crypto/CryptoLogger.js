/**
 * Mobile crypto logger.
 */
export class CryptoLogger {
  /**
   * Creates logger.
   * @param {object} options Logger options.
   */
  constructor(options = {}) {
    this.sink = options.sink || console;
  }

  /** @param {string} message Message. @param {object} data Data. */
  info(message, data = {}) { this.write('info', message, data); }

  /** @param {string} message Message. @param {object} data Data. */
  warn(message, data = {}) { this.write('warn', message, data); }

  /** @param {string} message Message. @param {object} data Data. */
  error(message, data = {}) { this.write('error', message, data); }

  /**
   * Writes redacted crypto log.
   * @param {string} level Level.
   * @param {string} message Message.
   * @param {object} data Data.
   */
  write(level, message, data = {}) {
    const writer = typeof this.sink[level] === 'function' ? this.sink[level] : this.sink.log;
    writer.call(this.sink, `[MOBILE_CHAT_CRYPTO] ${message}`, this.redact(data));
  }

  /**
   * Redacts key material.
   * @param {*} value Value.
   * @returns {*} Redacted value.
   */
  redact(value) {
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      /(private|secret|session|plaintext|ciphertext|key|material|token|password|otp)/i.test(key) ? '[REDACTED]' : child,
    ]));
  }
}

export default CryptoLogger;
