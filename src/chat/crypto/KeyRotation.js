/**
 * Mobile key rotation architecture.
 */
export class KeyRotation {
  /**
   * Creates key rotation.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.keyManager = options.keyManager;
    this.logger = options.logger;
    this.history = [];
  }

  /**
   * Rotates a key.
   * @param {object} input Input.
   * @returns {Promise<object>} Public rotation result.
   */
  async rotate(input) {
    const keyPair = input.keyType === 'device'
      ? await this.keyManager.generateDeviceKeyPair()
      : await this.keyManager.generateIdentityKeyPair();
    keyPair.keyVersion = Number(input.currentVersion || 1) + 1;
    await this.keyManager.storePrivateKey(`${input.keyType}:${input.ownerId}`, keyPair);
    const rotation = {
      ownerId: input.ownerId,
      keyType: input.keyType,
      previousFingerprint: input.previousFingerprint || null,
      fingerprint: keyPair.fingerprint,
      keyVersion: keyPair.keyVersion,
      reason: input.reason || 'manual',
      rotatedAt: new Date().toISOString(),
      futureMigration: null,
      publicKey: keyPair.publicKey,
      algorithm: keyPair.algorithm,
    };
    this.history.push(rotation);
    this.logger.info('Mobile crypto key rotated', { ownerId: input.ownerId, keyType: input.keyType, fingerprint: keyPair.fingerprint });
    return rotation;
  }
}

export default KeyRotation;
