/**
 * Mobile local archive manager.
 */
export class ArchiveManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.storage = options.storage;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /** @param {object} conversation Conversation. @returns {Promise<object>} Conversation. */
  async archive(conversation) {
    conversation.archived = true;
    conversation.updatedAt = new Date().toISOString();
    await this.storage.upsertConversation(conversation);
    await this.storage.audit({ event: 'Archived', conversationId: conversation.conversationId });
    this.eventBus?.emit?.(this.events.CONVERSATION_ARCHIVED, { conversationId: conversation.conversationId });
    return conversation;
  }

  /** @param {object} conversation Conversation. @returns {Promise<object>} Conversation. */
  async unarchive(conversation) {
    conversation.archived = false;
    conversation.updatedAt = new Date().toISOString();
    await this.storage.upsertConversation(conversation);
    await this.storage.audit({ event: 'Unarchived', conversationId: conversation.conversationId });
    this.eventBus?.emit?.(this.events.CONVERSATION_UNARCHIVED, { conversationId: conversation.conversationId });
    return conversation;
  }
}

export default ArchiveManager;
