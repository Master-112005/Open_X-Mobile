/**
 * Mobile contact discovery validation.
 */
export class DiscoveryValidation {
  /**
   * Validates phone input.
   * @param {*} value Phone number.
   * @returns {string} Phone number.
   */
  phoneNumber(value) {
    const phoneNumber = String(value || '').trim();
    if (!phoneNumber || phoneNumber.length > 32) throw new Error('A valid phone number is required for discovery.');
    return phoneNumber;
  }

  /**
   * Validates optional country code.
   * @param {*} value Country code.
   * @returns {string|null} Country code.
   */
  countryCode(value) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const countryCode = String(value).trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error('Discovery country code must be ISO-3166 alpha-2.');
    return countryCode;
  }

  /**
   * Validates own AccountID for settings operations.
   * @param {*} value AccountID.
   * @returns {string} AccountID.
   */
  accountId(value) {
    const accountId = String(value || '').trim().toLowerCase();
    if (!/^acc_[a-f0-9]{64}$/.test(accountId)) throw new Error('AccountID is invalid.');
    return accountId;
  }

  /**
   * Validates opaque contact token.
   * @param {*} value Token.
   * @returns {string} Token.
   */
  opaqueToken(value) {
    const token = String(value || '').trim();
    if (!/^oct_v1_[A-Za-z0-9_-]{32,160}$/.test(token)) throw new Error('Opaque contact token is invalid.');
    return token;
  }

  /**
   * Sanitizes metadata.
   * @param {*} value Metadata.
   * @returns {object} Metadata.
   */
  metadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      if (/^[a-z0-9_-]{1,40}$/i.test(key) && ['string', 'number', 'boolean'].includes(typeof child)) output[key] = child;
    }
    return output;
  }
}

export default DiscoveryValidation;
