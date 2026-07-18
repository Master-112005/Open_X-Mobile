/**
 * Mobile local Security Platform policy manager.
 */
export class SecurityPolicyManager {
  /**
   * Creates policy manager.
   * @param {object} options Policy options.
   */
  constructor(options = {}) {
    this.policy = Object.freeze({
      pinMinLength: Number(options.pinMinLength || 4),
      pinMaxLength: Number(options.pinMaxLength || 12),
      hideLoginHistory: options.hideLoginHistory === true,
      hideDeviceInformation: options.hideDeviceInformation === true,
      allowSecurityNotifications: options.allowSecurityNotifications !== false,
    });
  }

  /** @returns {object} Policy snapshot. */
  getPolicy() {
    return this.policy;
  }
}

export default SecurityPolicyManager;
