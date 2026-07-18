/**
 * Battery-aware optimizer for Mobile Chat background work.
 */
export class BatteryOptimizer {
  /**
   * Creates a battery optimizer.
   * @param {object} options Optimizer options.
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.lowBatteryThreshold = Number(options.lowBatteryThreshold || 0.2);
    this.state = { level: 1, charging: true };
  }

  /**
   * Updates current battery state.
   * @param {object} state Battery state.
   * @returns {object} Optimization status.
   */
  update(state = {}) {
    this.state = {
      level: Number.isFinite(Number(state.level)) ? Number(state.level) : this.state.level,
      charging: state.charging !== undefined ? state.charging === true : this.state.charging,
    };
    const status = this.getStatus();
    if (status.saverMode) this.eventBus?.emit?.('chat.infrastructure.battery_saver', status);
    return status;
  }

  /**
   * Returns battery optimization status.
   * @returns {object} Battery status.
   */
  getStatus() {
    const saverMode = !this.state.charging && this.state.level <= this.lowBatteryThreshold;
    return {
      ...this.state,
      saverMode,
      recommendedSyncIntervalMultiplier: saverMode ? 3 : 1,
    };
  }
}

export default BatteryOptimizer;
