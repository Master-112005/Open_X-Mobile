/**
 * Validates Mobile Chat production readiness gates.
 */
export class ProductionValidator {
  /**
   * Creates a production validator.
   * @param {object} options Validator dependencies.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.healthProvider = options.healthProvider;
    this.infrastructure = options.infrastructure || {};
    this.crashRecovery = options.crashRecovery;
    this.performanceReporter = options.performanceReporter;
  }

  /**
   * Runs production readiness gates.
   * @returns {object} Validation report.
   */
  validate() {
    const health = this.healthProvider?.() || {};
    const crash = this.crashRecovery?.getStatus?.() || { ready: false };
    const performance = this.performanceReporter?.createReport?.() || { ready: false };
    const gates = [
      this.gate('configuration', Boolean(this.config?.protocolVersion), 'Configuration is versioned.'),
      this.gate('feature_flags', this.config?.featureFlags?.productionReadiness === true, 'Production readiness flag is enabled.'),
      this.gate('health', Boolean(health.status || health.state || health.version), 'Health snapshot is available.'),
      this.gate('infrastructure', Boolean(this.infrastructure.monitoring), 'Infrastructure monitoring is attached.'),
      this.gate('crash_recovery', crash.ready === true, 'Crash recovery policy is available.'),
      this.gate('performance_reporting', performance.ready === true, 'Performance reporting is available.'),
    ];
    return Object.freeze({
      valid: gates.every((gate) => gate.pass),
      gates,
      details: { health, crash, performance },
      timestamp: new Date().toISOString(),
    });
  }

  gate(id, pass, description) {
    return Object.freeze({ id, pass: pass === true, description });
  }
}

export default ProductionValidator;
