import CryptoError from './CryptoErrors';

/**
 * Mobile crypto validation helpers.
 */
export class CryptoValidation {
  /**
   * Validates byte length.
   * @param {Uint8Array} value Bytes.
   * @param {number} length Required length.
   * @param {string} label Label.
   * @returns {Uint8Array} Bytes.
   */
  bytes(value, length, label) {
    if (!(value instanceof Uint8Array) || value.byteLength !== length) {
      throw new CryptoError('crypto.validation_failed', `${label} must be ${length} bytes.`);
    }
    return value;
  }

  /**
   * Validates fingerprint.
   * @param {string} fingerprint Fingerprint.
   * @returns {string} Fingerprint.
   */
  fingerprint(fingerprint) {
    const value = String(fingerprint || '').trim();
    if (!/^fp:v1:sha256:[a-f0-9]{64}$/.test(value)) throw new CryptoError('crypto.fingerprint_invalid', 'Fingerprint is invalid.');
    return value;
  }
}

export default CryptoValidation;
