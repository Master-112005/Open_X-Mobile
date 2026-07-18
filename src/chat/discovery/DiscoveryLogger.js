/**
 * Mobile discovery logger with token redaction.
 */
export class DiscoveryLogger {
  /**
   * Creates a discovery logger.
   * @param {object} options Logger options.
   */
  constructor(options = {}) {
    this.sink = options.sink || console;
  }

  /** @param {string} message Message. @param {object} data Metadata. */
  info(message, data = {}) { this.write('info', message, data); }

  /** @param {string} message Message. @param {object} data Metadata. */
  warn(message, data = {}) { this.write('warn', message, data); }

  /** @param {string} message Message. @param {object} data Metadata. */
  error(message, data = {}) { this.write('error', message, data); }

  /**
   * Writes a redacted log entry.
   * @param {string} level Level.
   * @param {string} message Message.
   * @param {object} data Metadata.
   */
  write(level, message, data = {}) {
    const writer = typeof this.sink[level] === 'function' ? this.sink[level] : this.sink.log;
    writer.call(this.sink, `[MOBILE_CHAT_DISCOVERY] ${message}`, this.redact(data));
  }

  /**
   * Redacts tokens and internal ids.
   * @param {*} value Value.
   * @returns {*} Redacted value.
   */
  redact(value) {
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      /(token|accountId|deviceId|secret|key)/i.test(key) ? '[REDACTED]' : child,
    ]));
  }
}

export default DiscoveryLogger;
