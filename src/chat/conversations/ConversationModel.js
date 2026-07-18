/**
 * Mobile local conversation record factory.
 */
export class ConversationModel {
  /** @returns {string} ConversationID. */
  static conversationId() {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return `conv_${Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
  }

  /**
   * Creates conversation record.
   * @param {object} input Input.
   * @returns {object} Conversation.
   */
  static create(input = {}) {
    const now = new Date(input.now || Date.now()).toISOString();
    return {
      conversationId: input.conversationId || ConversationModel.conversationId(),
      relationshipId: input.relationshipId,
      lastMessageId: input.lastMessageId || null,
      lastMessageTimestamp: input.lastMessageTimestamp || null,
      unreadCount: Number(input.unreadCount || 0),
      pinned: Boolean(input.pinned),
      archived: Boolean(input.archived),
      muted: Boolean(input.muted),
      deleted: Boolean(input.deleted),
      hidden: Boolean(input.hidden),
      favorite: Boolean(input.favorite),
      lastOpened: input.lastOpened || null,
      createdAt: input.createdAt || now,
      updatedAt: input.updatedAt || now,
      sortIndex: Number(input.sortIndex || 0),
      metadata: input.metadata || {},
      muteUntil: input.muteUntil || null,
      pinOrder: Number(input.pinOrder || 0),
      futureGroups: input.futureGroups || { enabled: false, groupId: null },
      futureFolders: input.futureFolders || { enabled: false, folderId: null },
    };
  }
}

export default ConversationModel;
