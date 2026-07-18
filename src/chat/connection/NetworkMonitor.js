/**
 * Mobile network monitor abstraction for reconnect and wake flows.
 */
export class NetworkMonitor {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.provider = options.provider || (async () => ({ online: true, type: 'unknown', quality: 'usable' }));
  }

  /** @returns {Promise<object>} Network status. */
  async getStatus() {
    const status = await this.provider();
    return {
      online: status?.online !== false,
      type: status?.type || 'unknown',
      quality: status?.online === false ? 'offline' : status?.quality || 'usable',
      expensive: Boolean(status?.expensive),
      shouldReconnect: status?.online !== false,
    };
  }
}

export default NetworkMonitor;
