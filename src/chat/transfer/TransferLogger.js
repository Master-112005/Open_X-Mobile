/**
 * Lightweight mobile transfer logger.
 */
export class TransferLogger {
  /** @param {string} message Message. @param {object} metadata Metadata. */
  info(message, metadata = {}) { this.write('info', message, metadata); }

  /** @param {string} message Message. @param {object} metadata Metadata. */
  warn(message, metadata = {}) { this.write('warn', message, metadata); }

  /** @param {string} message Message. @param {object} metadata Metadata. */
  error(message, metadata = {}) { this.write('error', message, metadata); }

  /**
   * Writes redacted transfer log.
   * @param {string} level Level.
   * @param {string} message Message.
   * @param {object} metadata Metadata.
   */
  write(level, message, metadata = {}) {
    if (globalThis.OPENX_CHAT_TRANSFER_LOGS !== true) return;
    const safe = { ...metadata };
    delete safe.key;
    delete safe.fileKey;
    delete safe.plaintext;
    delete safe.encryptedBlob;
    console[level === 'error' ? 'error' : 'log'](`[OpenXMobileTransfer:${level}] ${message}`, safe);
  }
}

export default TransferLogger;
