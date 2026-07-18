/**
 * Provides Mobile Chat version information.
 */
export class ChatVersionManager {
  /**
   * Creates a version manager.
   * @param {object} options Version options.
   */
  constructor(options = {}) {
    this.moduleVersion = String(options.moduleVersion || '0.1.0');
    this.protocolVersion = String(options.protocolVersion || '1');
  }

  /**
   * Returns version snapshot.
   * @returns {object} Version data.
   */
  getVersion() {
    return Object.freeze({
      moduleVersion: this.moduleVersion,
      protocolVersion: this.protocolVersion,
    });
  }
}

export default ChatVersionManager;
