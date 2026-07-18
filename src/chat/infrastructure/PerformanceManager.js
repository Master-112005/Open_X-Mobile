/**
 * Measures Mobile Chat operation performance.
 */
export class PerformanceManager {
  /**
   * Creates a performance manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.metrics = options.metrics;
    this.eventBus = options.eventBus;
    this.slowOperationMs = Number(options.slowOperationMs || 900);
  }

  /**
   * Measures an asynchronous operation.
   * @param {string} name Operation name.
   * @param {Function} task Async task.
   * @returns {Promise<*>} Task result.
   */
  async measure(name, task) {
    const startedAt = Date.now();
    try {
      return await task();
    } finally {
      const durationMs = Date.now() - startedAt;
      this.metrics?.recordLatency?.(name, durationMs);
      if (durationMs > this.slowOperationMs) this.eventBus?.emit?.('chat.infrastructure.performance_warning', { name, durationMs });
    }
  }

  /**
   * Returns performance status.
   * @returns {object} Performance status.
   */
  getStatus() {
    const latency = this.metrics?.getSnapshot?.().latency || { count: 0, p50Ms: 0, p95Ms: 0 };
    return { latency, slowOperationMs: this.slowOperationMs, warning: latency.p95Ms > this.slowOperationMs };
  }
}

export default PerformanceManager;
