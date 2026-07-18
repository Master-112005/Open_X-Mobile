/**
 * Privacy-safe Mobile Chat security logger.
 */
export class SecurityLogger {
  /** @param {string} message Message. @param {object} metadata Metadata. */
  info(message, metadata = {}) { this.write('info', message, metadata); }

  /** @param {string} message Message. @param {object} metadata Metadata. */
  warn(message, metadata = {}) { this.write('warn', message, metadata); }

  /** @param {string} message Message. @param {object} metadata Metadata. */
  error(message, metadata = {}) { this.write('error', message, metadata); }

  /**
   * Writes sanitized security logs.
   * @param {string} level Level.
   * @param {string} message Message.
   * @param {object} metadata Metadata.
   */
  write(level, message, metadata = {}) {
    const safe = Object.fromEntries(Object.entries(metadata).filter(([key]) => !/pin|otp|secret|private|token|key/i.test(key)));
    const writer = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    writer(`[OpenXMobileSecurity] ${message}`, safe);
  }
}

export default SecurityLogger;
