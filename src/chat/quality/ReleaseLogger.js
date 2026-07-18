/**
 * Privacy-safe release log for Mobile Chat production validation.
 */
export class ReleaseLogger {
  /**
   * Creates a release logger.
   * @param {object} options Logger options.
   */
  constructor(options = {}) {
    this.maxEntries = Number.isFinite(Number(options.maxEntries)) ? Number(options.maxEntries) : 100;
    this.entries = [];
  }

  /**
   * Records a release or quality event without private payloads.
   * @param {string} event Event name.
   * @param {object} metadata Safe metadata.
   * @returns {object} Stored entry.
   */
  record(event, metadata = {}) {
    const entry = Object.freeze({
      event: String(event || 'quality.event'),
      metadata: this.sanitize(metadata),
      timestamp: new Date().toISOString(),
    });
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.shift();
    return entry;
  }

  /**
   * Returns release log entries.
   * @returns {object[]} Entries.
   */
  list() {
    return this.entries.slice();
  }

  sanitize(value) {
    if (!value || typeof value !== 'object') return value;
    const blocked = /key|secret|token|password|pin|plaintext|message/i;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      blocked.test(key) ? '[redacted]' : item,
    ]));
  }
}

export default ReleaseLogger;
