/**
 * Dedicated Mobile Chat logger.
 */
export class ChatLogger {
  /**
   * Creates a logger.
   * @param {object} options Logger options.
   */
  constructor(options = {}) {
    this.level = String(options.level || 'info').toLowerCase();
    this.sink = options.sink || console;
    this.levels = Object.freeze({ error: 0, warn: 1, info: 2, debug: 3, trace: 4 });
  }

  /** @param {string} message Message text. @param {object} data Metadata. */
  error(message, data = {}) { this.write('error', message, data); }

  /** @param {string} message Message text. @param {object} data Metadata. */
  warn(message, data = {}) { this.write('warn', message, data); }

  /** @param {string} message Message text. @param {object} data Metadata. */
  info(message, data = {}) { this.write('info', message, data); }

  /** @param {string} message Message text. @param {object} data Metadata. */
  debug(message, data = {}) { this.write('debug', message, data); }

  /** @param {string} message Message text. @param {object} data Metadata. */
  trace(message, data = {}) { this.write('trace', message, data); }

  /**
   * Writes a scoped log entry.
   * @param {string} level Log level.
   * @param {string} message Message text.
   * @param {object} data Metadata.
   */
  write(level, message, data = {}) {
    if (this.levels[level] > this.levels[this.level]) return;
    const writer = typeof this.sink[level] === 'function' ? this.sink[level] : this.sink.log;
    writer.call(this.sink, `[MOBILE_CHAT] ${message}`, this.redact(data));
  }

  /**
   * Redacts future sensitive fields.
   * @param {*} value Value to redact.
   * @param {number} depth Recursion depth.
   * @returns {*} Redacted value.
   */
  redact(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 4) return value;
    if (Array.isArray(value)) return value.slice(0, 20).map((item) => this.redact(item, depth + 1));
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      /(token|secret|password|credential|key|otp)/i.test(key) ? '[REDACTED]' : this.redact(child, depth + 1),
    ]));
  }
}

export default ChatLogger;
