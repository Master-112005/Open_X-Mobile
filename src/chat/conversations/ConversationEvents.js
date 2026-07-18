/**
 * Mobile Phase 13 local conversation events.
 */
export const ConversationEvents = Object.freeze({
  CONVERSATION_CREATED: 'conversation:created',
  CONVERSATION_DELETED: 'conversation:deleted',
  CONVERSATION_RESTORED: 'conversation:restored',
  CONVERSATION_ARCHIVED: 'conversation:archived',
  CONVERSATION_UNARCHIVED: 'conversation:unarchived',
  CONVERSATION_PINNED: 'conversation:pinned',
  CONVERSATION_UNPINNED: 'conversation:unpinned',
  CONVERSATION_MUTED: 'conversation:muted',
  CONVERSATION_UNMUTED: 'conversation:unmuted',
  CONVERSATION_CLEARED: 'conversation:cleared',
  CONVERSATION_MARKED_READ: 'conversation:marked-read',
  CONVERSATION_MARKED_UNREAD: 'conversation:marked-unread',
  SEARCH_UPDATED: 'conversation:search-updated',
  INDEX_UPDATED: 'conversation:index-updated',
  PAGINATION_LOADED: 'conversation:pagination-loaded',
});

export default ConversationEvents;
