/**
 * Mobile crypto configuration.
 */
export class CryptoConfiguration {
  /**
   * Creates configuration.
   * @param {object} options Overrides.
   */
  constructor(options = {}) {
    this.aesAlgorithm = 'AES-GCM';
    this.keySizeBits = Number(options.keySizeBits || 256);
    this.keySizeBytes = Number(options.keySizeBytes || 32);
    this.ivSizeBytes = Number(options.ivSizeBytes || 12);
    this.tagSizeBytes = Number(options.tagSizeBytes || 16);
    this.hkdfHash = options.hkdfHash || 'SHA-256';
    this.replayWindowMs = Number(options.replayWindowMs || 300000);
    this.sessionTtlMs = Number(options.sessionTtlMs || 3600000);
    this.rotationIntervalMs = Number(options.rotationIntervalMs || 2592000000);
    this.identityAlgorithm = options.identityAlgorithm || { name: 'ECDSA', namedCurve: 'P-256' };
    this.deviceAlgorithm = options.deviceAlgorithm || { name: 'ECDSA', namedCurve: 'P-256' };
    this.storageRoot = options.storageRoot || '@openx-chat/crypto';
    this.wrappingKey = options.wrappingKey || null;
    Object.freeze(this);
  }
}

export default CryptoConfiguration;
