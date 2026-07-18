/**
 * Mobile local pin manager.
 */
export class PinManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.storage = options.storage;
    this.config = options.config;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /** @param {object} conversation Conversation. @returns {Promise<object>} Conversation. */
  async pin(conversation) {
    const pinned = (await this.storage.listConversations()).filter(item => item.pinned && !item.deleted);
    if (!conversation.pinned && pinned.length >= this.config.maxPinnedChats) throw new Error('Pinned chat limit reached.');
    conversation.pinned = true;
    conversation.pinOrder = conversation.pinOrder || pinned.length + 1;
    conversation.updatedAt = new Date().toISOString();
    await this.storage.upsertConversation(conversation);
    await this.storage.audit({ event: 'Pinned', conversationId: conversation.conversationId });
    this.eventBus?.emit?.(this.events.CONVERSATION_PINNED, { conversationId: conversation.conversationId });
    return conversation;
  }

  /** @param {object} conversation Conversation. @returns {Promise<object>} Conversation. */
  async unpin(conversation) {
    conversation.pinned = false;
    conversation.pinOrder = 0;
    conversation.updatedAt = new Date().toISOString();
    await this.storage.upsertConversation(conversation);
    await this.storage.audit({ event: 'Unpinned', conversationId: conversation.conversationId });
    this.eventBus?.emit?.(this.events.CONVERSATION_UNPINNED, { conversationId: conversation.conversationId });
    return conversation;
  }
}

export default PinManager;
