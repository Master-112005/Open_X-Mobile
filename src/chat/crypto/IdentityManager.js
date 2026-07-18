/**
 * Mobile account identity key manager.
 */
export class IdentityManager {
  /**
   * Creates identity manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.keyManager = options.keyManager;
    this.logger = options.logger;
  }

  /**
   * Generates local identity key and stores private part.
   * @param {string} accountId AccountID.
   * @returns {Promise<object>} Public identity.
   */
  async generateIdentity(accountId) {
    const keyPair = await this.keyManager.generateIdentityKeyPair();
    await this.keyManager.storePrivateKey(`identity:${accountId}`, keyPair);
    this.logger.info('Mobile identity generated', { accountId, fingerprint: keyPair.fingerprint });
    return {
      accountId,
      keyType: 'identity',
      publicKey: keyPair.publicKey,
      fingerprint: keyPair.fingerprint,
      algorithm: keyPair.algorithm,
      keyVersion: keyPair.keyVersion,
      metadata: { generatedAt: keyPair.createdAt },
    };
  }

  /**
   * Verifies public identity fingerprint.
   * @param {object} identity Public identity.
   * @returns {Promise<boolean>} Whether valid.
   */
  async verifyIdentity(identity) {
    return (await this.keyManager.fingerprint(identity.publicKey)) === identity.fingerprint;
  }
}

export default IdentityManager;
