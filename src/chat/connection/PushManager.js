/**
 * Mobile push registration and silent-payload validation manager.
 */
export class PushManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.eventBus = options.eventBus;
    this.events = options.events;
    this.tokenProvider = options.tokenProvider || (async () => null);
  }

  /** @param {object} input Token input. @returns {Promise<object|null>} Registration result. */
  async register(input = {}) {
    const pushToken = input.pushToken || await this.tokenProvider();
    if (!pushToken) return null;
    const response = await this.fetchImpl(`${this.config.apiBaseUrl}/connection/push-token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        accountId: input.accountId,
        deviceId: input.deviceId,
        provider: input.provider || this.config.pushProvider,
        platform: input.platform || this.config.platform,
        pushToken,
      }),
    });
    const json = await response.json();
    if (!response.ok || json.ok === false) throw new Error(json.error?.message || 'Push token registration failed.');
    return json.data;
  }

  /** @param {object} payload Push payload. @returns {object} Validated payload. */
  validatePayload(payload = {}) {
    const forbidden = ['message', 'messageText', 'senderName', 'phoneNumber', 'plaintext', 'privateKey'];
    if (forbidden.some((key) => Object.prototype.hasOwnProperty.call(payload, key))) {
      throw new Error('Push payload contains disallowed plaintext fields.');
    }
    if (!/^notif_[a-f0-9]{32}$/i.test(String(payload.notificationId || ''))) throw new Error('Push notification ID is invalid.');
    if (!/^hint_[a-f0-9]{32,64}$/i.test(String(payload.mailboxHint || ''))) throw new Error('Push mailbox hint is invalid.');
    this.eventBus?.emit?.(this.events.PUSH_RECEIVED, { notificationId: payload.notificationId, mailboxHint: payload.mailboxHint });
    return payload;
  }
}

export default PushManager;
