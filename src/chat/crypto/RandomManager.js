/**
 * Mobile secure random manager.
 */
export class RandomManager {
  /**
   * Generates random bytes.
   * @param {number} size Size.
   * @returns {Uint8Array} Random bytes.
   */
  bytes(size) {
    if (!globalThis.crypto?.getRandomValues) throw new Error('Secure random is unavailable.');
    const bytes = new Uint8Array(size);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  /** @returns {Uint8Array} Key bytes. */
  key() { return this.bytes(32); }

  /** @returns {Uint8Array} IV bytes. */
  iv() { return this.bytes(12); }

  /** @returns {Uint8Array} Nonce bytes. */
  nonce() { return this.bytes(24); }

  /** @returns {Uint8Array} Salt bytes. */
  salt() { return this.bytes(32); }

  /** @returns {string} Session id. */
  sessionId() { return `sess_${this.hex(this.bytes(24))}`; }

  /** @returns {string} Token id. */
  tokenId() { return `tok_${this.hex(this.bytes(24))}`; }

  /**
   * Converts bytes to hex.
   * @param {Uint8Array} bytes Bytes.
   * @returns {string} Hex.
   */
  hex(bytes) {
    return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}

export default RandomManager;
