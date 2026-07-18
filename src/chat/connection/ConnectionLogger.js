/**
 * Mobile connection logger that redacts sensitive values.
 */
export class ConnectionLogger {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.level = options.level || 'info';
  }

  /** @param {string} message Message. @param {object} metadata Metadata. */
  info(message, metadata = {}) { this.write('log', message, metadata); }

  /** @param {string} message Message. @param {object} metadata Metadata. */
  warn(message, metadata = {}) { this.write('warn', message, metadata); }

  /** @param {string} level Level. @param {string} message Message. @param {object} metadata Metadata. */
  write(level, message, metadata = {}) {
    if (this.level === 'silent') return;
    const safe = Object.fromEntries(Object.entries(metadata).map(([key, value]) => [
      key,
      /token|plaintext|privateKey|sessionKey|messageText/i.test(key) ? '[redacted]' : value,
    ]));
    console[level](`[OpenXMobileConnection] ${message}`, safe);
  }
}

export default ConnectionLogger;
