import { toBase64 } from '../crypto/Encoding';

/**
 * Mobile local conversation index manager.
 */
export class IndexManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.storage = options.storage;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /** @param {*} value Text. @returns {string[]} Tokens. */
  tokenize(value) {
    return [...new Set(String(value || '').toLowerCase().match(/[a-z0-9_@.+-]+/g) || [])];
  }

  /** @returns {string} IndexID. */
  indexId() {
    const bytes = new Uint8Array(18);
    globalThis.crypto.getRandomValues(bytes);
    return `idx_${toBase64(bytes)}`;
  }

  /** @param {object} conversation Conversation. */
  async indexConversation(conversation) {
    const metadataText = Object.values(conversation.metadata || {}).filter(value => ['string', 'number', 'boolean'].includes(typeof value)).join(' ');
    const tokens = this.tokenize(`${conversation.relationshipId} ${metadataText}`);
    await this.storage.replaceIndex(conversation.conversationId, 'Conversation', [{
      indexId: this.indexId(),
      conversationId: conversation.conversationId,
      relationshipId: conversation.relationshipId,
      messageId: null,
      type: 'Conversation',
      tokens,
      updatedAt: new Date().toISOString(),
    }]);
    this.eventBus?.emit?.(this.events.INDEX_UPDATED, { conversationId: conversation.conversationId, type: 'Conversation' });
  }

  /** @param {object} input Message index input. */
  async indexMessage(input = {}) {
    const text = input.searchText || input.text || input.preview || '';
    const tokens = this.tokenize(text);
    if (!tokens.length || !input.messageId) return;
    await this.storage.upsertSearchRecord({
      indexId: `idx_msg_${input.messageId}`,
      conversationId: input.conversationId,
      relationshipId: input.relationshipId,
      messageId: input.messageId,
      type: 'Message',
      tokens,
      updatedAt: new Date().toISOString(),
    });
    this.eventBus?.emit?.(this.events.INDEX_UPDATED, { conversationId: input.conversationId, type: 'Message' });
  }

  /** @returns {Promise<object>} Rebuild result. */
  async rebuild() {
    const conversations = await this.storage.listConversations();
    for (const conversation of conversations) await this.indexConversation(conversation);
    const history = this.storage.state.ConversationHistory || [];
    for (const record of history) await this.indexMessage(record);
    return { conversations: conversations.length, messages: history.length };
  }

  /** @returns {Promise<object>} Optimize result. */
  async optimize() {
    await this.storage.initialize();
    const seen = new Set();
    this.storage.state.SearchIndex = this.storage.state.SearchIndex.filter((record) => {
      const key = `${record.type}:${record.conversationId}:${record.messageId || ''}:${record.tokens.join('|')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    await this.storage.persist();
    return { records: this.storage.state.SearchIndex.length };
  }

  /** @param {string} conversationId ConversationID. */
  async deleteConversationIndex(conversationId) {
    await this.storage.replaceIndex(conversationId, null, []);
  }
}

export default IndexManager;
