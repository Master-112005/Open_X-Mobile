/**
 * Mobile local mute manager.
 */
export class MuteManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.storage = options.storage;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /** @param {object} conversation Conversation. @param {object} options Options. @returns {Promise<object>} Conversation. */
  async mute(conversation, options = {}) {
    conversation.muted = true;
    conversation.muteUntil = options.durationMs ? new Date(Date.now() + Number(options.durationMs)).toISOString() : null;
    conversation.updatedAt = new Date().toISOString();
    await this.storage.upsertConversation(conversation);
    await this.storage.audit({ event: 'Muted', conversationId: conversation.conversationId, muteUntil: conversation.muteUntil });
    this.eventBus?.emit?.(this.events.CONVERSATION_MUTED, { conversationId: conversation.conversationId, muteUntil: conversation.muteUntil });
    return conversation;
  }

  /** @param {object} conversation Conversation. @returns {Promise<object>} Conversation. */
  async unmute(conversation) {
    conversation.muted = false;
    conversation.muteUntil = null;
    conversation.updatedAt = new Date().toISOString();
    await this.storage.upsertConversation(conversation);
    await this.storage.audit({ event: 'Unmuted', conversationId: conversation.conversationId });
    this.eventBus?.emit?.(this.events.CONVERSATION_UNMUTED, { conversationId: conversation.conversationId });
    return conversation;
  }
}

export default MuteManager;
