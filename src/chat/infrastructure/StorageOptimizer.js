/**
 * Tracks Mobile Chat storage pressure.
 */
export class StorageOptimizer {
  /**
   * Creates a storage optimizer.
   * @param {object} options Optimizer options.
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.maxRecords = Number(options.maxRecords || 5000);
    this.collections = new Map();
  }

  /**
   * Tracks a collection size.
   * @param {string} name Collection name.
   * @param {number} count Record count.
   */
  trackCollection(name, count) {
    const value = Number(count) || 0;
    this.collections.set(name, value);
    if (value > this.maxRecords) this.eventBus?.emit?.('chat.infrastructure.storage_pressure', { name, count: value });
  }

  /**
   * Returns storage status.
   * @returns {object} Storage status.
   */
  getStatus() {
    const collections = Object.fromEntries(this.collections);
    return {
      collections,
      cleanup: Object.entries(collections).filter(([, count]) => count > this.maxRecords).map(([name, count]) => ({ name, count, action: 'trim_old_records' })),
      maxRecords: this.maxRecords,
    };
  }
}

export default StorageOptimizer;
