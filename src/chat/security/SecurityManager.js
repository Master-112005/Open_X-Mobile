import RecoveryManager from './RecoveryManager';
import RegistrationPinManager from './RegistrationPinManager';
import SecurityClient from './SecurityClient';
import SecurityEvents from './SecurityEvents';
import SecurityLogger from './SecurityLogger';
import SecurityPolicyManager from './SecurityPolicyManager';
import SessionManager from './SessionManager';
import TrustManager from './TrustManager';

/**
 * Mobile Security Platform facade.
 */
export class SecurityManager {
  /**
   * Creates security manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config || {};
    this.eventBus = options.eventBus;
    this.logger = options.logger || new SecurityLogger();
    this.client = options.client || new SecurityClient({ config: this.config, fetchImpl: options.fetchImpl });
    this.policy = options.policyManager || new SecurityPolicyManager(this.config);
    this.pin = options.registrationPinManager || new RegistrationPinManager({ client: this.client, eventBus: this.eventBus, logger: this.logger });
    this.recovery = options.recoveryManager || new RecoveryManager({ client: this.client, eventBus: this.eventBus });
    this.trust = options.trustManager || new TrustManager({ client: this.client, eventBus: this.eventBus });
    this.sessions = options.sessionManager || new SessionManager({ eventBus: this.eventBus, timeoutMs: this.config.sessionTimeoutMs });
  }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  createPin(input) { return this.pin.create(input); }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  verifyPin(input) { return this.pin.verify(input); }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  updatePin(input) { return this.pin.update(input); }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  approveDevice(input) { return this.trust.approveDevice(input); }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  revokeDevice(input) { return this.trust.revokeDevice(input); }

  /** @param {string} accountId AccountID. @returns {Promise<object>} Result. */
  trustedDevices(accountId) { return this.trust.trustedDevices(accountId); }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  startRecovery(input) { return this.recovery.start(input); }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  completeRecovery(input) { return this.recovery.complete(input); }

  /** @param {string} accountId AccountID. @returns {Promise<object>} Result. */
  loginHistory(accountId) { return this.client.loginHistory(accountId); }
}

SecurityManager.Events = SecurityEvents;

export default SecurityManager;
