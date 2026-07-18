import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Mobile local conversation database backed by AsyncStorage.
 */
export class ConversationStorage {
  /**
   * Creates storage.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.state = this.empty();
    this.started = false;
    this.writeQueue = Promise.resolve();
  }

  /**
   * Initializes local database.
   */
  async initialize() {
    if (this.started) return;
    const raw = await AsyncStorage.getItem(this.config.storageKey);
    this.state = raw ? this.normalize(JSON.parse(raw)) : this.empty();
    if (!raw) await this.persist();
    this.started = true;
  }

  /**
   * Creates empty local tables.
   * @returns {object} Empty database.
   */
  empty() {
    return {
      version: 1,
      Conversations: [],
      ConversationMetadata: [],
      ConversationIndex: [],
      PinnedChats: [],
      ArchivedChats: [],
      MutedChats: [],
      DeletedChats: [],
      SearchIndex: [],
      ConversationHistory: [],
      ConversationAudit: [],
      LocalStatistics: [],
      FutureFolders: [],
      FutureGroups: [],
    };
  }

  /** @param {object} state Loaded state. @returns {object} Normalized state. */
  normalize(state) {
    const empty = this.empty();
    const output = { version: Number(state?.version || 1) };
    Object.keys(empty).filter(key => key !== 'version').forEach((key) => {
      output[key] = Array.isArray(state?.[key]) ? state[key] : [];
    });
    return output;
  }

  /** @returns {Promise<object[]>} Conversations. */
  async listConversations() {
    await this.initialize();
    return this.state.Conversations.map(item => this.clone(item));
  }

  /** @param {string} conversationId ConversationID. @returns {Promise<object|null>} Conversation. */
  async getConversation(conversationId) {
    await this.initialize();
    return this.clone(this.state.Conversations.find(item => item.conversationId === conversationId) || null);
  }

  /** @param {string} relationshipId RelationshipID. @returns {Promise<object|null>} Conversation. */
  async getConversationByRelationship(relationshipId) {
    await this.initialize();
    return this.clone(this.state.Conversations.find(item => item.relationshipId === relationshipId && !item.deleted) || null);
  }

  /** @param {object} conversation Conversation. */
  async upsertConversation(conversation) {
    await this.initialize();
    const record = this.clone(conversation);
    const index = this.state.Conversations.findIndex(item => item.conversationId === record.conversationId);
    if (index >= 0) this.state.Conversations[index] = record;
    else this.state.Conversations.push(record);
    this.syncDerivedTables(record);
    await this.persist();
  }

  /** @param {string} conversationId ConversationID. */
  async removeConversation(conversationId) {
    await this.initialize();
    ['Conversations', 'ConversationMetadata', 'ConversationIndex', 'PinnedChats', 'ArchivedChats', 'MutedChats', 'DeletedChats', 'SearchIndex', 'ConversationHistory'].forEach((key) => {
      this.state[key] = this.state[key].filter(item => item.conversationId !== conversationId);
    });
    await this.persist();
  }

  /** @param {object} record History record. */
  async addHistory(record) {
    await this.initialize();
    const entry = this.clone(record);
    const index = this.state.ConversationHistory.findIndex(item => item.messageId && item.messageId === entry.messageId);
    if (index >= 0) this.state.ConversationHistory[index] = entry;
    else this.state.ConversationHistory.push(entry);
    await this.persist();
  }

  /** @param {string} conversationId ConversationID. @returns {Promise<object[]>} History. */
  async listHistory(conversationId) {
    await this.initialize();
    return this.state.ConversationHistory.filter(item => item.conversationId === conversationId).map(item => this.clone(item));
  }

  /** @param {string} conversationId ConversationID. */
  async clearHistory(conversationId) {
    await this.initialize();
    this.state.ConversationHistory = this.state.ConversationHistory.filter(item => item.conversationId !== conversationId);
    this.state.SearchIndex = this.state.SearchIndex.filter(item => !(item.conversationId === conversationId && item.type === 'Message'));
    await this.persist();
  }

  /** @param {string} conversationId ConversationID. @param {string|null} type Type. @param {object[]} records Records. */
  async replaceIndex(conversationId, type, records) {
    await this.initialize();
    this.state.SearchIndex = this.state.SearchIndex.filter((item) => {
      if (item.conversationId !== conversationId) return true;
      return type ? item.type !== type : false;
    });
    this.state.SearchIndex.push(...records);
    await this.persist();
  }

  /** @param {object} record Record. */
  async upsertSearchRecord(record) {
    await this.initialize();
    const index = this.state.SearchIndex.findIndex(item => item.indexId === record.indexId);
    if (index >= 0) this.state.SearchIndex[index] = record;
    else this.state.SearchIndex.push(record);
    await this.persist();
  }

  /** @returns {Promise<object[]>} Search records. */
  async listSearchIndex() {
    await this.initialize();
    return this.state.SearchIndex.map(item => this.clone(item));
  }

  /** @param {object} event Audit event. */
  async audit(event) {
    await this.initialize();
    const safe = { ...event };
    delete safe.text;
    delete safe.plaintext;
    delete safe.content;
    delete safe.message;
    this.state.ConversationAudit.push({ ...safe, createdAt: safe.createdAt || new Date().toISOString() });
    await this.persist();
  }

  /** @param {object} conversation Conversation. */
  syncDerivedTables(conversation) {
    this.state.ConversationMetadata = this.state.ConversationMetadata.filter(item => item.conversationId !== conversation.conversationId);
    this.state.ConversationMetadata.push({
      conversationId: conversation.conversationId,
      relationshipId: conversation.relationshipId,
      metadata: conversation.metadata,
      updatedAt: conversation.updatedAt,
    });
    this.state.PinnedChats = this.upsertFlagTable(this.state.PinnedChats, conversation, conversation.pinned, { pinOrder: conversation.pinOrder });
    this.state.ArchivedChats = this.upsertFlagTable(this.state.ArchivedChats, conversation, conversation.archived);
    this.state.MutedChats = this.upsertFlagTable(this.state.MutedChats, conversation, conversation.muted, { muteUntil: conversation.muteUntil });
    this.state.DeletedChats = this.upsertFlagTable(this.state.DeletedChats, conversation, conversation.deleted);
  }

  /** @param {object[]} table Table. @param {object} conversation Conversation. @param {boolean} enabled Enabled. @param {object} extra Extra. @returns {object[]} Table. */
  upsertFlagTable(table, conversation, enabled, extra = {}) {
    const filtered = table.filter(item => item.conversationId !== conversation.conversationId);
    if (!enabled) return filtered;
    filtered.push({
      conversationId: conversation.conversationId,
      relationshipId: conversation.relationshipId,
      updatedAt: conversation.updatedAt,
      ...extra,
    });
    return filtered;
  }

  /**
   * Persists database.
   */
  async persist() {
    this.writeQueue = this.writeQueue.then(() => AsyncStorage.setItem(this.config.storageKey, JSON.stringify(this.state)));
    await this.writeQueue;
  }

  /** @param {*} value Value. @returns {*} Clone. */
  clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }
}

export default ConversationStorage;
