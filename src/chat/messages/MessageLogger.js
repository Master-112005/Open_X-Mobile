/**
 * Mobile privacy-safe message logger.
 */
export class MessageLogger {
  /**
   * Creates logger.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.sink = options.sink || console;
  }

  /** @param {string} message Message. @param {object} metadata Metadata. */
  info(message, metadata = {}) { this.write('info', message, metadata); }

  /** @param {string} message Message. @param {object} metadata Metadata. */
  warn(message, metadata = {}) { this.write('warn', message, metadata); }

  /** @param {string} message Message. @param {object} metadata Metadata. */
  error(message, metadata = {}) { this.write('error', message, metadata); }

  /**
   * Writes sanitized metadata.
   * @param {string} level Level.
   * @param {string} message Message.
   * @param {object} metadata Metadata.
   */
  write(level, message, metadata = {}) {
    this.sink?.[level]?.(`[OpenXChatMessage] ${message}`, this.redact(metadata));
  }

  /**
   * Redacts sensitive values.
   * @param {*} value Value.
   * @returns {*} Redacted value.
   */
  redact(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      /plain|content|cipher|key|secret|token/i.test(key) ? '[redacted]' : this.redact(child),
    ]));
  }
}

export default MessageLogger;
