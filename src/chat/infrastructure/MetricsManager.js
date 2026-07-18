/**
 * Local metrics manager for Mobile Chat.
 */
export class MetricsManager {
  /**
   * Creates a metrics manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.maxSamples = Number(options.maxSamples || 300);
    this.counters = new Map();
    this.latencies = [];
    this.startedAt = Date.now();
  }

  /**
   * Increments a counter.
   * @param {string} name Counter name.
   * @param {number} amount Increment amount.
   * @returns {number} New value.
   */
  increment(name, amount = 1) {
    const value = (this.counters.get(name) || 0) + amount;
    this.counters.set(name, value);
    this.eventBus?.emit?.('chat.infrastructure.metric_recorded', { name, value });
    return value;
  }

  /**
   * Records operation latency.
   * @param {string} name Operation name.
   * @param {number} durationMs Duration in ms.
   */
  recordLatency(name, durationMs) {
    this.latencies.push({ name, durationMs: Math.max(0, Number(durationMs) || 0), at: Date.now() });
    if (this.latencies.length > this.maxSamples) this.latencies.splice(0, this.latencies.length - this.maxSamples);
    this.increment(`latency.${name}.count`);
  }

  /**
   * Returns metrics snapshot.
   * @returns {object} Metrics snapshot.
   */
  getSnapshot() {
    const durations = this.latencies.map((item) => item.durationMs).sort((a, b) => a - b);
    return {
      uptimeMs: Date.now() - this.startedAt,
      counters: Object.fromEntries(this.counters),
      latency: {
        count: durations.length,
        p50Ms: this.percentile(durations, 0.5),
        p95Ms: this.percentile(durations, 0.95),
      },
      timestamp: new Date().toISOString(),
    };
  }

  percentile(sorted, percentile) {
    if (!sorted.length) return 0;
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentile) - 1))];
  }
}

export default MetricsManager;
