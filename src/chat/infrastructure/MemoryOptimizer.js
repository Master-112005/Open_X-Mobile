/**
 * Tracks Mobile Chat memory pressure from caller-provided snapshots.
 */
export class MemoryOptimizer {
  /**
   * Creates a memory optimizer.
   * @param {object} options Optimizer options.
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.heapWarningBytes = Number(options.heapWarningBytes || 128 * 1024 * 1024);
    this.snapshot = { heapUsed: 0, rss: 0 };
  }

  /**
   * Updates memory snapshot.
   * @param {object} snapshot Memory snapshot.
   * @returns {object} Memory status.
   */
  update(snapshot = {}) {
    this.snapshot = {
      heapUsed: Number(snapshot.heapUsed || 0),
      rss: Number(snapshot.rss || 0),
    };
    return this.getStatus();
  }

  /**
   * Returns memory status.
   * @returns {object} Memory status.
   */
  getStatus() {
    const pressure = this.snapshot.heapUsed > this.heapWarningBytes;
    if (pressure) this.eventBus?.emit?.('chat.infrastructure.memory_pressure', { heapUsed: this.snapshot.heapUsed });
    return { memory: this.snapshot, pressure, heapWarningBytes: this.heapWarningBytes };
  }
}

export default MemoryOptimizer;
