import AESManager from './AESManager';
import CryptoConfiguration from './CryptoConfiguration';
import CryptoLogger from './CryptoLogger';
import CryptoValidation from './CryptoValidation';
import HKDFManager from './HKDFManager';
import IdentityManager from './IdentityManager';
import KeyManager from './KeyManager';
import KeyRotation from './KeyRotation';
import RandomManager from './RandomManager';
import ReplayManager from './ReplayManager';
import SecureStorageManager from './SecureStorageManager';
import SessionManager from './SessionManager';

/**
 * Mobile Chat cryptographic composition root.
 */
export class CryptoManager {
  /**
   * Creates crypto manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof CryptoConfiguration ? options.config : new CryptoConfiguration(options.config || {});
    this.logger = options.logger || new CryptoLogger();
    this.validation = options.validation || new CryptoValidation();
    this.random = options.random || new RandomManager();
    this.aes = options.aes || new AESManager({ config: this.config, random: this.random });
    this.hkdf = options.hkdf || new HKDFManager({ config: this.config });
    this.storage = options.storage || new SecureStorageManager({ config: this.config, aes: this.aes, random: this.random });
    this.keyManager = options.keyManager || new KeyManager({ config: this.config, storage: this.storage, logger: this.logger });
    this.identity = options.identity || new IdentityManager({ keyManager: this.keyManager, logger: this.logger });
    this.sessions = options.sessions || new SessionManager({ config: this.config, random: this.random, logger: this.logger });
    this.replay = options.replay || new ReplayManager({ config: this.config, logger: this.logger });
    this.rotation = options.rotation || new KeyRotation({ keyManager: this.keyManager, logger: this.logger });
  }

  /**
   * Initializes secure storage.
   */
  async initialize() {
    await this.storage.initialize();
  }
}

export default CryptoManager;
