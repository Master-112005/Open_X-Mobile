/**
 * Aggregates Mobile Chat infrastructure status.
 */
export class MonitoringManager {
  /**
   * Creates monitoring manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.metrics = options.metrics;
    this.performance = options.performance;
    this.battery = options.battery;
    this.connection = options.connection;
    this.storage = options.storage;
    this.memory = options.memory;
    this.synchronization = options.synchronization;
  }

  /**
   * Returns infrastructure status.
   * @returns {object} Status.
   */
  getStatus() {
    return {
      metrics: this.metrics?.getSnapshot?.() || null,
      performance: this.performance?.getStatus?.() || null,
      battery: this.battery?.getStatus?.() || null,
      connection: this.connection?.getStatus?.() || null,
      storage: this.storage?.getStatus?.() || null,
      memory: this.memory?.getStatus?.() || null,
      synchronization: {
        defaultBatchSize: this.synchronization?.defaultBatchSize || 0,
        maxBatchSize: this.synchronization?.maxBatchSize || 0,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export default MonitoringManager;
