import AsyncStorage from '@react-native-async-storage/async-storage';
import RequestConfiguration from './RequestConfiguration';
import RequestEvents from './RequestEvents';
import RequestLogger from './RequestLogger';
import RequestValidation from './RequestValidation';

/**
 * Mobile private nickname manager. Nicknames stay local to this device.
 */
export class NicknameManager {
  /**
   * Creates a nickname manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof RequestConfiguration ? options.config : new RequestConfiguration(options.config || {});
    this.eventBus = options.eventBus;
    this.logger = options.logger || new RequestLogger();
    this.validator = options.validator || new RequestValidation({ config: this.config });
    this.storage = options.storage || AsyncStorage;
    this.nicknames = new Map();
    this.loaded = false;
  }

  /**
   * Loads nicknames from AsyncStorage.
   */
  async load() {
    if (this.loaded) return;
    const raw = await this.storage.getItem(this.config.nicknameStorageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    for (const record of Array.isArray(parsed?.nicknames) ? parsed.nicknames : []) {
      if (record?.ownerAccountId && record?.targetAccountId) this.nicknames.set(this.key(record.ownerAccountId, record.targetAccountId), record);
    }
    this.loaded = true;
  }

  /**
   * Sets a private nickname for an account.
   * @param {object} input Nickname input.
   * @returns {Promise<object>} Nickname record.
   */
  async setNickname(input = {}) {
    await this.load();
    const ownerAccountId = this.validator.accountId(input.ownerAccountId);
    const targetAccountId = this.validator.accountId(input.targetAccountId);
    const record = {
      ownerAccountId,
      targetAccountId,
      nickname: this.validator.nickname(input.nickname),
      status: 'Active',
      updatedAt: new Date().toISOString(),
      futureOwnDeviceSynchronization: { enabled: false, phase: 'future' },
    };
    this.nicknames.set(this.key(ownerAccountId, targetAccountId), record);
    await this.persist();
    this.emit(RequestEvents.NICKNAME_UPDATED, { ownerAccountId, targetAccountId });
    return record;
  }

  /**
   * Deletes a private nickname.
   * @param {object} input Delete input.
   * @returns {Promise<object|null>} Deleted record or null.
   */
  async deleteNickname(input = {}) {
    await this.load();
    const ownerAccountId = this.validator.accountId(input.ownerAccountId);
    const targetAccountId = this.validator.accountId(input.targetAccountId);
    const key = this.key(ownerAccountId, targetAccountId);
    const existing = this.nicknames.get(key) || null;
    this.nicknames.delete(key);
    await this.persist();
    this.emit(RequestEvents.NICKNAME_DELETED, { ownerAccountId, targetAccountId });
    return existing ? { ...existing, status: 'Deleted', updatedAt: new Date().toISOString() } : null;
  }

  /**
   * Gets a private nickname.
   * @param {string} ownerAccountId Owner AccountID.
   * @param {string} targetAccountId Target AccountID.
   * @returns {Promise<object|null>} Nickname.
   */
  async getNickname(ownerAccountId, targetAccountId) {
    await this.load();
    return this.nicknames.get(this.key(this.validator.accountId(ownerAccountId), this.validator.accountId(targetAccountId))) || null;
  }

  /**
   * Lists private nicknames for an owner.
   * @param {string} ownerAccountId Owner AccountID.
   * @returns {Promise<object[]>} Nicknames.
   */
  async listNicknames(ownerAccountId) {
    await this.load();
    const owner = this.validator.accountId(ownerAccountId);
    return Array.from(this.nicknames.values()).filter(record => record.ownerAccountId === owner);
  }

  /**
   * Persists nickname records.
   */
  async persist() {
    await this.storage.setItem(this.config.nicknameStorageKey, JSON.stringify({
      schemaVersion: 1,
      nicknames: Array.from(this.nicknames.values()),
    }));
  }

  /**
   * Builds a stable owner-target key.
   * @param {string} ownerAccountId Owner AccountID.
   * @param {string} targetAccountId Target AccountID.
   * @returns {string} Storage key.
   */
  key(ownerAccountId, targetAccountId) {
    return `${ownerAccountId}:${targetAccountId}`;
  }

  /**
   * Emits an event.
   * @param {string} eventName Event name.
   * @param {object} payload Payload.
   */
  emit(eventName, payload = {}) {
    this.eventBus?.emit?.(eventName, payload);
  }
}

export default NicknameManager;
