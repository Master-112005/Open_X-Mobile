import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Mobile local encrypted message storage.
 */
export class MessageStorage {
  /**
   * Creates message storage.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.storage = options.storage || AsyncStorage;
    this.state = this.empty();
    this.started = false;
  }

  /**
   * Initializes storage.
   */
  async initialize() {
    if (this.started) return;
    const raw = await this.storage.getItem(this.config.storageKey);
    try {
      this.state = raw ? this.normalize(JSON.parse(raw)) : this.empty();
      this.pruneMessages();
    } catch {
      this.state = this.empty();
      await this.storage.removeItem(this.config.storageKey);
    }
    if (!raw) await this.persist();
    this.started = true;
  }

  /**
   * Creates empty local tables.
   * @returns {object} Empty state.
   */
  empty() {
    return {
      version: 1,
      messages: [],
      messageStatus: [],
      readState: [],
      retryQueue: [],
      typingState: [],
      compressionMetadata: [],
      futureAttachmentPlaceholder: [],
      futureReactionPlaceholder: [],
    };
  }

  /**
   * Normalizes state.
   * @param {object} state State.
   * @returns {object} Normalized state.
   */
  normalize(state) {
    const empty = this.empty();
    return {
      version: Number(state?.version || 1),
      ...Object.fromEntries(Object.keys(empty).filter((key) => key !== 'version').map((key) => [key, Array.isArray(state?.[key]) ? state[key] : empty[key]])),
    };
  }

  /**
   * Upserts encrypted message.
   * @param {object} message Message.
   */
  async upsertMessage(message) {
    await this.initialize();
    const index = this.state.messages.findIndex((item) => item.messageId === message.messageId);
    if (index >= 0) this.state.messages[index] = message;
    else this.state.messages.push(message);
    await this.setStatus(message.messageId, message.status, false);
    await this.persist();
  }

  /**
   * Prunes local message tables to the configured storage cap.
   */
  pruneMessages() {
    const limit = Math.max(1, Math.floor(Number(this.config.maxStoredMessages) || 300));
    const retainedMessages = this.state.messages.length > limit
      ? this.state.messages.slice(-limit)
      : this.state.messages;
    const keepIds = new Set(retainedMessages.map((message) => message.messageId).filter(Boolean));
    this.state.messages = retainedMessages;
    ['messageStatus', 'readState', 'retryQueue', 'compressionMetadata', 'futureAttachmentPlaceholder', 'futureReactionPlaceholder'].forEach((key) => {
      this.state[key] = this.state[key].filter((item) => keepIds.has(item.messageId));
    });
  }

  /**
   * Gets one local message.
   * @param {string} messageId MessageID.
   * @returns {Promise<object|null>} Message.
   */
  async getMessage(messageId) {
    await this.initialize();
    return this.state.messages.find((message) => message.messageId === messageId) || null;
  }

  /**
   * Sets status.
   * @param {string} messageId MessageID.
   * @param {string} status Status.
   * @param {boolean} persist Persist flag.
   */
  async setStatus(messageId, status, persist = true) {
    const now = new Date().toISOString();
    const record = { messageId, status, updatedAt: now };
    const index = this.state.messageStatus.findIndex((item) => item.messageId === messageId);
    if (index >= 0) this.state.messageStatus[index] = record;
    else this.state.messageStatus.push(record);
    const message = this.state.messages.find((item) => item.messageId === messageId);
    if (message) message.status = status;
    if (persist) await this.persist();
  }

  /**
   * Marks message read locally.
   * @param {string} messageId MessageID.
   * @param {string|null} readAt Read timestamp.
   */
  async markRead(messageId, readAt = null) {
    await this.initialize();
    const state = { messageId, unread: false, read: true, readAt: readAt || new Date().toISOString() };
    const index = this.state.readState.findIndex((item) => item.messageId === messageId);
    if (index >= 0) this.state.readState[index] = state;
    else this.state.readState.push(state);
    const message = this.state.messages.find((item) => item.messageId === messageId);
    if (message) message.readState = state;
    await this.persist();
  }

  /**
   * Upserts retry state.
   * @param {object} retry Retry.
   */
  async upsertRetry(retry) {
    await this.initialize();
    const index = this.state.retryQueue.findIndex((item) => item.messageId === retry.messageId);
    if (index >= 0) this.state.retryQueue[index] = retry;
    else this.state.retryQueue.push(retry);
    await this.persist();
  }

  /**
   * Persists local state.
   */
  persist() {
    this.pruneMessages();
    return this.storage.setItem(this.config.storageKey, JSON.stringify(this.state));
  }
}

export default MessageStorage;
