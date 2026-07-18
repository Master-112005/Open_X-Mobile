/**
 * Plans battery-aware Mobile Chat synchronization batches.
 */
export class SynchronizationOptimizer {
  /**
   * Creates a synchronization optimizer.
   * @param {object} options Optimizer options.
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.battery = options.battery;
    this.defaultBatchSize = Number(options.defaultBatchSize || 30);
    this.maxBatchSize = Number(options.maxBatchSize || 100);
  }

  /**
   * Plans a bounded synchronization batch.
   * @param {object} input Sync input.
   * @returns {object} Sync plan.
   */
  planBatch(input = {}) {
    const pending = Math.max(0, Number(input.pending || 0));
    const batteryStatus = this.battery?.getStatus?.() || { saverMode: false };
    const max = batteryStatus.saverMode ? Math.max(1, Math.floor(this.maxBatchSize / 2)) : this.maxBatchSize;
    const requested = Number(input.limit || this.defaultBatchSize);
    const limit = Math.min(max, Math.max(1, requested), Math.max(1, pending || requested));
    const plan = { pending, limit, shouldRun: pending > 0, batterySaver: batteryStatus.saverMode };
    this.eventBus?.emit?.('chat.infrastructure.sync_batch_planned', plan);
    return plan;
  }
}

export default SynchronizationOptimizer;
